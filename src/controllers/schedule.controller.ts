import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Schedule } from '../entities/Schedule.entity';
import { Module } from '../entities/Module.entity';
import { Batch } from '../entities/Batch.entity';
import { Lecturer } from '../entities/Lecturer.entity';
import { Center } from '../entities/Center.entity';
import { Attendance } from '../entities/Attendance.entity';
import { ScheduleStatus } from '../enums/ScheduleStatus.enum';
import { ScheduleType } from '../enums/ScheduleType.enum';
import { Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';

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
        startDate = '',
        endDate = '',
        sortBy = 'date',
        sortOrder = 'DESC',
      } = req.query;

      // Auto-complete finished schedules before fetching
      await this.autoCompleteFinishedSchedules();

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
          '(module.moduleName ILIKE :search OR batch.batchNumber ILIKE :search OR schedule.lectureHall ILIKE :search)',
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
      if (lecturerId) {
        queryBuilder.andWhere('schedule.lecturerId = :lecturerId', { lecturerId });
      }

      // Center filter
      if (centerId) {
        queryBuilder.andWhere('schedule.centerId = :centerId', { centerId });
      }

      // Status filter
      if (status) {
        queryBuilder.andWhere('schedule.status = :status', { status });
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
      } = req.body;

      // Verify module exists
      const module = await this.moduleRepository.findOne({
        where: { id: moduleId },
      });

      if (!module) {
        return res.status(404).json({
          status: 'error',
          message: 'Module not found',
        });
      }

      // Verify batch exists
      const batch = await this.batchRepository.findOne({
        where: { id: batchId },
      });

      if (!batch) {
        return res.status(404).json({
          status: 'error',
          message: 'Batch not found',
        });
      }

      // Verify lecturer exists
      const lecturer = await this.lecturerRepository.findOne({
        where: { id: lecturerId },
      });

      if (!lecturer) {
        return res.status(404).json({
          status: 'error',
          message: 'Lecturer not found',
        });
      }

      // Verify center exists
      const center = await this.centerRepository.findOne({
        where: { id: centerId },
      });

      if (!center) {
        return res.status(404).json({
          status: 'error',
          message: 'Center not found',
        });
      }

      // Validate time
      if (startTime >= endTime) {
        return res.status(400).json({
          status: 'error',
          message: 'End time must be after start time',
        });
      }

      // Check for conflicts
      const conflicts = await this.checkScheduleConflicts(
        date,
        startTime,
        endTime,
        lecturerId,
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
        date: new Date(date),
        startTime,
        endTime,
        lectureHall,
        status: status || ScheduleStatus.SCHEDULED,
        type: type || ScheduleType.PHYSICAL,
      });

      schedule.module = module;
      schedule.batch = batch;
      schedule.lecturer = lecturer;
      schedule.center = center;

      await this.scheduleRepository.save(schedule);

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
      } = req.body;

      const schedule = await this.scheduleRepository.findOne({
        where: { id },
        relations: ['module', 'batch', 'lecturer', 'center'],
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
        lecturerId || schedule.lecturer.id,
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
        const module = await this.moduleRepository.findOne({
          where: { id: moduleId },
        });
        if (!module) {
          return res.status(404).json({
            status: 'error',
            message: 'Module not found',
          });
        }
        schedule.module = module;
      }

      if (batchId) {
        const batch = await this.batchRepository.findOne({
          where: { id: batchId },
        });
        if (!batch) {
          return res.status(404).json({
            status: 'error',
            message: 'Batch not found',
          });
        }
        schedule.batch = batch;
      }

      if (lecturerId) {
        const lecturer = await this.lecturerRepository.findOne({
          where: { id: lecturerId },
        });
        if (!lecturer) {
          return res.status(404).json({
            status: 'error',
            message: 'Lecturer not found',
          });
        }
        schedule.lecturer = lecturer;
      }

      if (centerId) {
        const center = await this.centerRepository.findOne({
          where: { id: centerId },
        });
        if (!center) {
          return res.status(404).json({
            status: 'error',
            message: 'Center not found',
          });
        }
        schedule.center = center;
      }

      await this.scheduleRepository.save(schedule);

      // Fetch updated schedule with relations
      const updatedSchedule = await this.scheduleRepository.findOne({
        where: { id: schedule.id },
        relations: ['module', 'batch', 'lecturer', 'lecturer.user', 'center'],
      });

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
        relations: ['attendances'],
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

      const totalSchedules = await this.scheduleRepository.count();

      const scheduledCount = await this.scheduleRepository.count({
        where: { status: ScheduleStatus.SCHEDULED },
      });

      const completedCount = await this.scheduleRepository.count({
        where: { status: ScheduleStatus.COMPLETED },
      });

      const cancelledCount = await this.scheduleRepository.count({
        where: { status: ScheduleStatus.CANCELLED },
      });

      // Get today's schedules
      const today = new Date().toISOString().split('T')[0];
      const todaySchedules = await this.scheduleRepository.count({
        where: { date: new Date(today) },
      });

      // Get upcoming schedules (next 7 days)
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const upcomingSchedules = await this.scheduleRepository.count({
        where: {
          date: Between(new Date(), nextWeek),
          status: ScheduleStatus.SCHEDULED,
        },
      });

      res.json({
        status: 'success',
        data: {
          totalSchedules,
          scheduledCount,
          completedCount,
          cancelledCount,
          todaySchedules,
          upcomingSchedules,
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
    lecturerId: string,
    lectureHall: string,
    centerId: string,
    excludeScheduleId?: string
  ) {
    const conflicts = [];

    const queryBuilder = this.scheduleRepository
      .createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.lecturer', 'lecturer')
      .leftJoinAndSelect('lecturer.user', 'lecturerUser')
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

      // Lecturer conflict
      if (existing.lecturer.id === lecturerId) {
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
      if (existing.lectureHall === lectureHall && existing.center.id === centerId) {
        conflicts.push({
          type: 'HALL',
          message: `Lecture hall ${lectureHall} is already booked at this time`,
          schedule: {
            id: existing.id,
            time: `${existing.startTime} - ${existing.endTime}`,
            lecturer: `${existing.lecturer.user.firstName} ${existing.lecturer.user.lastName}`,
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

      // Find all scheduled sessions that have already ended
      // They are either from previous days OR today but with endTime < current time
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
      // We don't throw here to avoid breaking the main request flow
    }
  }
}

export default new ScheduleController();
