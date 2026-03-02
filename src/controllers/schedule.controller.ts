import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Schedule } from '../entities/Schedule.entity';
import { Module } from '../entities/Module.entity';
import { Batch } from '../entities/Batch.entity';
import { Lecturer } from '../entities/Lecturer.entity';
import { Center } from '../entities/Center.entity';
import { Attendance } from '../entities/Attendance.entity';
import { Enrollment } from '../entities/Enrollment.entity';
import { EnrollmentStatus } from '../enums/EnrollmentStatus.enum';
import { ScheduleStatus } from '../enums/ScheduleStatus.enum';
import { ScheduleType } from '../enums/ScheduleType.enum';
import { ScheduleCategory } from '../enums/ScheduleCategory.enum';
import { Between, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { User } from '../entities/User.entity';

import { Role } from '../enums/Role.enum';
import notificationService from '../services/notification.service';
import { NotificationType } from '../enums/NotificationType.enum';

export class ScheduleController {
  private scheduleRepository = AppDataSource.getRepository(Schedule);
  private moduleRepository = AppDataSource.getRepository(Module);
  private batchRepository = AppDataSource.getRepository(Batch);
  private lecturerRepository = AppDataSource.getRepository(Lecturer);
  private centerRepository = AppDataSource.getRepository(Center);
  private attendanceRepository = AppDataSource.getRepository(Attendance);

  // Get all schedules with pagination and filters
  async getAllSchedules(req: Request, res: Response) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        moduleId = '',
        batchId = '',
        lecturerId = '',
        centerId = '',
        status = '',
        category = '',
        startDate = '',
        endDate = '',
        sortBy = 'date',
        sortOrder = 'DESC',
      } = req.query;

      // Auto-complete finished schedules before fetching
      await this.autoCompleteFinishedSchedules();

      const user = (req as any).user;
      let filterLecturerId = (lecturerId as string) || '';

      if (user.role === Role.LECTURER) {
        const lecturer = await this.lecturerRepository.findOne({
          where: { user: { id: user.userId } },
        });
        if (lecturer) {
          filterLecturerId = lecturer.id;
        }
      }

      const skip = (Number(page) - 1) * Number(limit);

      const queryBuilder = this.scheduleRepository
        .createQueryBuilder('schedule')
        .leftJoinAndSelect('schedule.module', 'module')
        .leftJoinAndSelect('schedule.batch', 'batch')
        .leftJoinAndSelect('schedule.lecturer', 'lecturer')
        .leftJoinAndSelect('lecturer.user', 'lecturerUser')
        .leftJoinAndSelect('schedule.center', 'center')
        .leftJoinAndSelect('schedule.attendances', 'attendances')
        .skip(skip)
        .take(Number(limit))
        .orderBy(`schedule.${sortBy}`, sortOrder as 'ASC' | 'DESC');

      // Search filter
      if (search) {
        queryBuilder.where(
          '(module.moduleName ILIKE :search OR batch.batchNumber ILIKE :search OR schedule.lectureHall ILIKE :search OR schedule.title ILIKE :search)',
          { search: `%${search}%` }
        );
      }

      // Module filter
      if (moduleId) {
        queryBuilder.andWhere('schedule.moduleId = :moduleId', { moduleId });
      }

      // Batch filter
      if (batchId) {
        queryBuilder.andWhere('schedule.batchId = :batchId', { batchId });
      }

      // Lecturer filter
      if (filterLecturerId) {
        queryBuilder.andWhere('schedule.lecturerId = :filterLecturerId', { filterLecturerId });
      }

      // Center filter
      if (centerId) {
        queryBuilder.andWhere('schedule.centerId = :centerId', { centerId });
      }

      // Status filter
      if (status) {
        queryBuilder.andWhere('schedule.status = :status', { status });
      }

      // Category filter
      if (category) {
        queryBuilder.andWhere('schedule.category = :category', { category });
      }

      // Date range filter
      if (startDate && endDate) {
        queryBuilder.andWhere('schedule.date BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        });
      } else if (startDate) {
        queryBuilder.andWhere('schedule.date >= :startDate', { startDate });
      } else if (endDate) {
        queryBuilder.andWhere('schedule.date <= :endDate', { endDate });
      }

      const [schedules, total] = await queryBuilder.getManyAndCount();

      // Add statistics for each schedule
      const schedulesWithStats = schedules.map(schedule => ({
        ...schedule,
        stats: {
          attendanceCount: schedule.attendances.length,
        },
      }));

      res.json({
        status: 'success',
        data: {
          schedules: schedulesWithStats,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch schedules',
      });
    }
  }

  // Get schedule by ID
  async getScheduleById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Auto-complete finished schedules before fetching
      await this.autoCompleteFinishedSchedules();

      const schedule = await this.scheduleRepository.findOne({
        where: { id },
        relations: [
          'module',
          'module.program',
          'batch',
          'lecturer',
          'lecturer.user',
          'center',
          'attendances',
          'attendances.student',
          'attendances.student.user',
        ],
      });

      if (!schedule) {
        return res.status(404).json({
          status: 'error',
          message: 'Schedule not found',
        });
      }

      // Get statistics
      const totalStudents = schedule.attendances.length;
      const presentCount = schedule.attendances.filter(a => a.status === 'PRESENT').length;
      const absentCount = schedule.attendances.filter(a => a.status === 'ABSENT').length;
      const lateCount = schedule.attendances.filter(a => a.status === 'LATE').length;

      res.json({
        status: 'success',
        data: {
          schedule: {
            ...schedule,
            stats: {
              totalStudents,
              presentCount,
              absentCount,
              lateCount,
              attendanceRate:
                totalStudents > 0 ? ((presentCount / totalStudents) * 100).toFixed(2) : 0,
            },
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch schedule',
      });
    }
  }

  // Create new schedule with conflict detection
  async createSchedule(req: Request, res: Response) {
    try {
      const {
        moduleId,
        batchId,
        lecturerId,
        centerId,
        date,
        startTime,
        endTime,
        lectureHall,
        status,
        type,
        category,
        title,
        description,
      } = req.body;

      const scheduleCategory = category || ScheduleCategory.CLASS;
      const isEvent = scheduleCategory !== ScheduleCategory.CLASS;

      // For class schedules, module/batch/lecturer are required
      if (!isEvent) {
        if (!moduleId) {
          return res.status(400).json({ status: 'error', message: 'Module is required for class schedules' });
        }
        if (!batchId) {
          return res.status(400).json({ status: 'error', message: 'Batch is required for class schedules' });
        }
        if (!lecturerId) {
          return res.status(400).json({ status: 'error', message: 'Lecturer is required for class schedules' });
        }
      }

      // For event schedules, title is required
      if (isEvent && !title) {
        return res.status(400).json({ status: 'error', message: 'Title is required for event schedules' });
      }

      // Center is always required
      if (!centerId) {
        return res.status(400).json({ status: 'error', message: 'Center is required' });
      }

      // Verify center exists
      const center = await this.centerRepository.findOne({ where: { id: centerId } });
      if (!center) {
        return res.status(404).json({ status: 'error', message: 'Center not found' });
      }

      // Validate time
      if (startTime >= endTime) {
        return res.status(400).json({ status: 'error', message: 'End time must be after start time' });
      }

      // Resolve optional relations
      let module: Module | null = null;
      let batch: Batch | null = null;
      let lecturer: Lecturer | null = null;

      if (moduleId) {
        module = await this.moduleRepository.findOne({ where: { id: moduleId } });
        if (!module) {
          return res.status(404).json({ status: 'error', message: 'Module not found' });
        }
      }

      if (batchId) {
        batch = await this.batchRepository.findOne({ where: { id: batchId } });
        if (!batch) {
          return res.status(404).json({ status: 'error', message: 'Batch not found' });
        }
      }

      if (lecturerId) {
        lecturer = await this.lecturerRepository.findOne({ where: { id: lecturerId }, relations: ['user'] });
        if (!lecturer) {
          return res.status(404).json({ status: 'error', message: 'Lecturer not found' });
        }
      }

      // Check for conflicts
      const conflicts = await this.checkScheduleConflicts(
        date,
        startTime,
        endTime,
        lecturerId || null,
        lectureHall,
        centerId
      );

      if (conflicts.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Schedule conflicts detected',
          conflicts,
        });
      }

      // Create schedule
      const schedule = this.scheduleRepository.create({
        category: scheduleCategory,
        title: title || null,
        description: description || null,
        date: new Date(date),
        startTime,
        endTime,
        lectureHall,
        status: status || ScheduleStatus.SCHEDULED,
        type: type || ScheduleType.PHYSICAL,
      });

      if (module) schedule.module = module;
      if (batch) schedule.batch = batch;
      if (lecturer) schedule.lecturer = lecturer;
      schedule.center = center;

      await this.scheduleRepository.save(schedule);

      // Send notifications
      try {
        const dateStr = new Date(date).toLocaleDateString();
        const scheduleName = isEvent ? title : module?.moduleName || 'Class';
        const categoryLabel = this.getCategoryLabel(scheduleCategory);
        const notificationTitle = isEvent
          ? `New ${categoryLabel}: ${title}`
          : `New Schedule: ${scheduleName}`;
        const notificationMessage = isEvent
          ? `A new ${categoryLabel.toLowerCase()} "${title}" has been scheduled on ${dateStr} at ${startTime}.${description ? ' ' + description : ''}`
          : `A new lecture has been scheduled for ${scheduleName} on ${dateStr} at ${startTime}.`;

        if (batch) {
          // Notify students in the batch
          const enrollments = await AppDataSource.getRepository(Enrollment).find({
            where: { batch: { id: batch.id }, status: EnrollmentStatus.ACTIVE },
            relations: ['student', 'student.user']
          });

          const studentUserIds = enrollments.map(e => e.student.user.id);

          if (studentUserIds.length > 0) {
            await notificationService.createNotifications({
              userIds: studentUserIds,
              title: notificationTitle,
              message: notificationMessage,
              type: NotificationType.SCHEDULE,
              link: '/student/schedule',
              sendEmail: true
            });
          }

          // Notify lecturer if assigned
          if (lecturer) {
            await notificationService.createNotification({
              userId: lecturer.user.id,
              title: notificationTitle,
              message: notificationMessage,
              type: NotificationType.SCHEDULE,
              link: '/lecturer/schedule',
              sendEmail: true
            });
          }
        } else {
          // No batch specified — notify all students and lecturers only
          const studentsAndLecturers = await AppDataSource.getRepository(User).find({
            where: { role: In([Role.STUDENT, Role.LECTURER]) },
            select: ['id']
          });
          const userIds = studentsAndLecturers.map(u => u.id);

          if (userIds.length > 0) {
            await notificationService.createNotifications({
              userIds,
              title: notificationTitle,
              message: notificationMessage,
              type: NotificationType.SCHEDULE,
              link: '/student/schedule',
              sendEmail: true
            });
          }
        }
      } catch (notifyError) {
        console.error('Failed to send notifications for new schedule:', notifyError);
      }

      // Fetch complete schedule with relations
      const completeSchedule = await this.scheduleRepository.findOne({
        where: { id: schedule.id },
        relations: ['module', 'batch', 'lecturer', 'lecturer.user', 'center'],
      });

      res.status(201).json({
        status: 'success',
        message: 'Schedule created successfully',
        data: { schedule: completeSchedule },
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to create schedule',
      });
    }
  }

  // Update schedule
  async updateSchedule(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const {
        moduleId,
        batchId,
        lecturerId,
        centerId,
        date,
        startTime,
        endTime,
        lectureHall,
        status,
        type,
        category,
        title,
        description,
      } = req.body;

      const schedule = await this.scheduleRepository.findOne({
        where: { id },
        relations: ['module', 'batch', 'lecturer', 'lecturer.user', 'center'],
      });

      if (!schedule) {
        return res.status(404).json({
          status: 'error',
          message: 'Schedule not found',
        });
      }

      // Update fields
      if (date) schedule.date = new Date(date);
      if (startTime) schedule.startTime = startTime;
      if (endTime) schedule.endTime = endTime;
      if (lectureHall) schedule.lectureHall = lectureHall;
      if (status) schedule.status = status;
      if (type) schedule.type = type;
      if (category) schedule.category = category;
      if (title !== undefined) schedule.title = title || null;
      if (description !== undefined) schedule.description = description || null;

      // Validate time
      if (schedule.startTime >= schedule.endTime) {
        return res.status(400).json({
          status: 'error',
          message: 'End time must be after start time',
        });
      }

      // Check for conflicts (excluding current schedule)
      const conflicts = await this.checkScheduleConflicts(
        schedule.date.toISOString().split('T')[0],
        schedule.startTime,
        schedule.endTime,
        lecturerId || schedule.lecturer?.id || null,
        lectureHall || schedule.lectureHall,
        centerId || schedule.center.id,
        id
      );

      if (conflicts.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Schedule conflicts detected',
          conflicts,
        });
      }

      // Update relations if provided
      if (moduleId) {
        const module = await this.moduleRepository.findOne({ where: { id: moduleId } });
        if (!module) {
          return res.status(404).json({ status: 'error', message: 'Module not found' });
        }
        schedule.module = module;
      }

      if (batchId) {
        const batch = await this.batchRepository.findOne({ where: { id: batchId } });
        if (!batch) {
          return res.status(404).json({ status: 'error', message: 'Batch not found' });
        }
        schedule.batch = batch;
      }

      if (lecturerId) {
        const lecturer = await this.lecturerRepository.findOne({ where: { id: lecturerId }, relations: ['user'] });
        if (!lecturer) {
          return res.status(404).json({ status: 'error', message: 'Lecturer not found' });
        }
        schedule.lecturer = lecturer;
      }

      if (centerId) {
        const center = await this.centerRepository.findOne({ where: { id: centerId } });
        if (!center) {
          return res.status(404).json({ status: 'error', message: 'Center not found' });
        }
        schedule.center = center;
      }

      await this.scheduleRepository.save(schedule);

      // Fetch updated schedule with relations
      const updatedSchedule = await this.scheduleRepository.findOne({
        where: { id: schedule.id },
        relations: ['module', 'batch', 'lecturer', 'lecturer.user', 'center'],
      });

      // Send update notifications
      try {
        if (updatedSchedule) {
          const isEvent = updatedSchedule.category !== ScheduleCategory.CLASS;
          const dateStr = updatedSchedule.date.toLocaleDateString();
          const scheduleName = isEvent ? updatedSchedule.title : updatedSchedule.module?.moduleName || 'Class';
          const categoryLabel = this.getCategoryLabel(updatedSchedule.category);
          const notificationTitle = isEvent
            ? `${categoryLabel} Updated: ${updatedSchedule.title}`
            : `Schedule Updated: ${scheduleName}`;
          const notificationMessage = isEvent
            ? `The ${categoryLabel.toLowerCase()} "${updatedSchedule.title}" on ${dateStr} has been updated. Time: ${updatedSchedule.startTime}.`
            : `The lecture for ${scheduleName} on ${dateStr} has been updated. New time: ${updatedSchedule.startTime}.`;

          if (updatedSchedule.batch) {
            const enrollments = await AppDataSource.getRepository(Enrollment).find({
              where: { batch: { id: updatedSchedule.batch.id }, status: EnrollmentStatus.ACTIVE },
              relations: ['student', 'student.user']
            });

            const studentUserIds = enrollments.map(e => e.student.user.id);

            if (studentUserIds.length > 0) {
              await notificationService.createNotifications({
                userIds: studentUserIds,
                title: notificationTitle,
                message: notificationMessage,
                type: NotificationType.SCHEDULE,
                link: '/student/schedule',
                sendEmail: true
              });
            }

            if (updatedSchedule.lecturer) {
              await notificationService.createNotification({
                userId: updatedSchedule.lecturer.user.id,
                title: notificationTitle,
                message: notificationMessage,
                type: NotificationType.SCHEDULE,
                link: '/lecturer/schedule',
                sendEmail: true
              });
            }
          } else {
            // No batch — notify all students and lecturers only
            const studentsAndLecturers = await AppDataSource.getRepository(User).find({
              where: { role: In([Role.STUDENT, Role.LECTURER]) },
              select: ['id']
            });
            const userIds = studentsAndLecturers.map(u => u.id);

            if (userIds.length > 0) {
              await notificationService.createNotifications({
                userIds,
                title: notificationTitle,
                message: notificationMessage,
                type: NotificationType.SCHEDULE,
                link: '/student/schedule',
                sendEmail: true
              });
            }
          }
        }
      } catch (notifyError) {
        console.error('Failed to send notifications for updated schedule:', notifyError);
      }

      res.json({
        status: 'success',
        message: 'Schedule updated successfully',
        data: { schedule: updatedSchedule },
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to update schedule',
      });
    }
  }

  // Delete schedule
  async deleteSchedule(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const schedule = await this.scheduleRepository.findOne({
        where: { id },
        relations: ['attendances', 'module', 'batch', 'lecturer', 'lecturer.user', 'center'],
      });

      if (!schedule) {
        return res.status(404).json({
          status: 'error',
          message: 'Schedule not found',
        });
      }

      // Check if schedule has attendance records
      if (schedule.attendances && schedule.attendances.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: `Cannot delete schedule with ${schedule.attendances.length} attendance records`,
        });
      }

      // Notify before removing
      try {
        const isEvent = schedule.category !== ScheduleCategory.CLASS;
        const dateStr = schedule.date.toLocaleDateString();
        const scheduleName = isEvent ? schedule.title : schedule.module?.moduleName || 'Class';
        const categoryLabel = this.getCategoryLabel(schedule.category);
        const notificationTitle = isEvent
          ? `${categoryLabel} Cancelled: ${schedule.title}`
          : `Schedule Cancelled: ${scheduleName}`;
        const notificationMessage = isEvent
          ? `The ${categoryLabel.toLowerCase()} "${schedule.title}" on ${dateStr} has been cancelled.`
          : `The lecture for ${scheduleName} on ${dateStr} has been cancelled.`;

        if (schedule.batch) {
          const enrollments = await AppDataSource.getRepository(Enrollment).find({
            where: { batch: { id: schedule.batch.id }, status: EnrollmentStatus.ACTIVE },
            relations: ['student', 'student.user']
          });

          const studentUserIds = enrollments.map(e => e.student.user.id);

          if (studentUserIds.length > 0) {
            await notificationService.createNotifications({
              userIds: studentUserIds,
              title: notificationTitle,
              message: notificationMessage,
              type: NotificationType.SCHEDULE,
              sendEmail: true
            });
          }

          if (schedule.lecturer) {
            await notificationService.createNotification({
              userId: schedule.lecturer.user.id,
              title: notificationTitle,
              message: notificationMessage,
              type: NotificationType.SCHEDULE,
              sendEmail: true
            });
          }
        } else {
          // No batch — notify all students and lecturers only
          const studentsAndLecturers = await AppDataSource.getRepository(User).find({
            where: { role: In([Role.STUDENT, Role.LECTURER]) },
            select: ['id']
          });
          const userIds = studentsAndLecturers.map(u => u.id);

          if (userIds.length > 0) {
            await notificationService.createNotifications({
              userIds,
              title: notificationTitle,
              message: notificationMessage,
              type: NotificationType.SCHEDULE,
              sendEmail: true
            });
          }
        }
      } catch (notifyError) {
        console.error('Failed to send notifications for deleted schedule:', notifyError);
      }

      await this.scheduleRepository.remove(schedule);

      res.json({
        status: 'success',
        message: 'Schedule deleted successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to delete schedule',
      });
    }
  }

  // Get schedule statistics
  async getScheduleStats(req: Request, res: Response) {
    try {
      // Auto-complete finished schedules before fetching stats
      await this.autoCompleteFinishedSchedules();

      const user = (req as any).user;
      let lecturerId: string | undefined;

      if (user.role === Role.LECTURER) {
        const lecturer = await this.lecturerRepository.findOne({
          where: { user: { id: user.userId } },
        });
        if (lecturer) {
          lecturerId = lecturer.id;
        }
      }

      const totalSchedules = await this.scheduleRepository.count({
        where: lecturerId ? { lecturer: { id: lecturerId } } : {},
      });

      const scheduledCount = await this.scheduleRepository.count({
        where: {
          status: ScheduleStatus.SCHEDULED,
          ...(lecturerId && { lecturer: { id: lecturerId } }),
        },
      });

      const completedCount = await this.scheduleRepository.count({
        where: {
          status: ScheduleStatus.COMPLETED,
          ...(lecturerId && { lecturer: { id: lecturerId } }),
        },
      });

      const cancelledCount = await this.scheduleRepository.count({
        where: {
          status: ScheduleStatus.CANCELLED,
          ...(lecturerId && { lecturer: { id: lecturerId } }),
        },
      });

      // Get today's schedules
      const today = new Date().toISOString().split('T')[0];
      const todaySchedules = await this.scheduleRepository.count({
        where: {
          date: new Date(today),
          ...(lecturerId && { lecturer: { id: lecturerId } }),
        },
      });

      // Get upcoming schedules (next 7 days)
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const upcomingSchedules = await this.scheduleRepository.count({
        where: {
          date: Between(new Date(), nextWeek),
          status: ScheduleStatus.SCHEDULED,
          ...(lecturerId && { lecturer: { id: lecturerId } }),
        },
      });

      // Event count
      const eventCount = await this.scheduleRepository
        .createQueryBuilder('schedule')
        .where('schedule.category != :classCategory', { classCategory: ScheduleCategory.CLASS })
        .getCount();

      res.json({
        status: 'success',
        data: {
          totalSchedules,
          scheduledCount,
          completedCount,
          cancelledCount,
          todaySchedules,
          upcomingSchedules,
          eventCount,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch statistics',
      });
    }
  }

  // Check schedule conflicts
  private async checkScheduleConflicts(
    date: string,
    startTime: string,
    endTime: string,
    lecturerId: string | null,
    lectureHall: string,
    centerId: string,
    excludeScheduleId?: string
  ) {
    const conflicts = [];

    const queryBuilder = this.scheduleRepository
      .createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.lecturer', 'lecturer')
      .leftJoinAndSelect('lecturer.user', 'lecturerUser')
      .leftJoinAndSelect('schedule.center', 'center')
      .where('schedule.date = :date', { date })
      .andWhere('schedule.status != :cancelled', { cancelled: ScheduleStatus.CANCELLED });

    if (excludeScheduleId) {
      queryBuilder.andWhere('schedule.id != :excludeScheduleId', { excludeScheduleId });
    }

    const existingSchedules = await queryBuilder.getMany();

    for (const existing of existingSchedules) {
      // Check time overlap
      const hasTimeConflict =
        (startTime >= existing.startTime && startTime < existing.endTime) ||
        (endTime > existing.startTime && endTime <= existing.endTime) ||
        (startTime <= existing.startTime && endTime >= existing.endTime);

      if (!hasTimeConflict) continue;

      // Lecturer conflict (only if both have a lecturer)
      if (lecturerId && existing.lecturer && existing.lecturer.id === lecturerId) {
        conflicts.push({
          type: 'LECTURER',
          message: `Lecturer ${existing.lecturer.user.firstName} ${existing.lecturer.user.lastName} is already scheduled at this time`,
          schedule: {
            id: existing.id,
            time: `${existing.startTime} - ${existing.endTime}`,
            hall: existing.lectureHall,
          },
        });
      }

      // Lecture hall conflict
      if (existing.lectureHall === lectureHall && existing.center?.id === centerId) {
        conflicts.push({
          type: 'HALL',
          message: `Lecture hall ${lectureHall} is already booked at this time`,
          schedule: {
            id: existing.id,
            time: `${existing.startTime} - ${existing.endTime}`,
            lecturer: existing.lecturer ? `${existing.lecturer.user.firstName} ${existing.lecturer.user.lastName}` : 'N/A',
          },
        });
      }
    }

    return conflicts;
  }

  // Get schedules for a specific date
  async getSchedulesByDate(req: Request, res: Response) {
    try {
      const { date } = req.params;

      // Auto-complete finished schedules before fetching
      await this.autoCompleteFinishedSchedules();

      const schedules = await this.scheduleRepository.find({
        where: { date: new Date(date) },
        relations: ['module', 'batch', 'lecturer', 'lecturer.user', 'center'],
        order: { startTime: 'ASC' },
      });

      res.json({
        status: 'success',
        data: { schedules },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch schedules',
      });
    }
  }

  // Get lecturer schedule
  async getLecturerSchedule(req: Request, res: Response) {
    try {
      const { lecturerId } = req.params;
      const { startDate, endDate } = req.query;

      // Auto-complete finished schedules before fetching
      await this.autoCompleteFinishedSchedules();

      const queryBuilder = this.scheduleRepository
        .createQueryBuilder('schedule')
        .leftJoinAndSelect('schedule.module', 'module')
        .leftJoinAndSelect('schedule.batch', 'batch')
        .leftJoinAndSelect('schedule.center', 'center')
        .where('schedule.lecturerId = :lecturerId', { lecturerId })
        .orderBy('schedule.date', 'ASC')
        .addOrderBy('schedule.startTime', 'ASC');

      if (startDate && endDate) {
        queryBuilder.andWhere('schedule.date BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        });
      }

      const schedules = await queryBuilder.getMany();

      res.json({
        status: 'success',
        data: { schedules },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch lecturer schedule',
      });
    }
  }

  // Internal helper to automatically complete finished schedules
  private async autoCompleteFinishedSchedules() {
    try {
      const now = new Date();
      const currentDate = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:mm

      const finishedSchedules = await this.scheduleRepository
        .createQueryBuilder('schedule')
        .where('schedule.status = :status', { status: ScheduleStatus.SCHEDULED })
        .andWhere('(schedule.date < :currentDate OR (schedule.date = :currentDate AND schedule.endTime < :currentTime))', {
          currentDate,
          currentTime,
        })
        .getMany();

      if (finishedSchedules.length > 0) {
        for (const schedule of finishedSchedules) {
          schedule.status = ScheduleStatus.COMPLETED;
        }
        await this.scheduleRepository.save(finishedSchedules);
      }
    } catch (error) {
      console.error('Error in autoCompleteFinishedSchedules:', error);
    }
  }

  // Helper to get human-readable category label
  private getCategoryLabel(category: ScheduleCategory): string {
    const labels: Record<ScheduleCategory, string> = {
      [ScheduleCategory.CLASS]: 'Class',
      [ScheduleCategory.SEMINAR]: 'Seminar',
      [ScheduleCategory.WORKSHOP]: 'Workshop',
      [ScheduleCategory.EXAM]: 'Exam',
      [ScheduleCategory.SPORTS_DAY]: 'Sports Day',
      [ScheduleCategory.GUEST_LECTURE]: 'Guest Lecture',
      [ScheduleCategory.OTHER]: 'Event',
    };
    return labels[category] || 'Event';
  }
}

export default new ScheduleController();
