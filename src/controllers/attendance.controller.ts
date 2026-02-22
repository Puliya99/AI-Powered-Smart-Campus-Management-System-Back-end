import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Attendance } from '../entities/Attendance.entity';
import { Schedule } from '../entities/Schedule.entity';
import { Student } from '../entities/Student.entity';
import { Enrollment } from '../entities/Enrollment.entity';
import { AttendanceStatus } from '../enums/AttendanceStatus.enum';
import { ScheduleStatus } from '../enums/ScheduleStatus.enum';
import { Between } from 'typeorm';
import attendanceService from '../services/attendance.service';

export class AttendanceController {
  private attendanceRepository = AppDataSource.getRepository(Attendance);
  private scheduleRepository = AppDataSource.getRepository(Schedule);
  private studentRepository = AppDataSource.getRepository(Student);
  private enrollmentRepository = AppDataSource.getRepository(Enrollment);

  // Fingerprint scan endpoint: maps fingerprintId -> student and records entry/exit
  async scanFingerprint(req: Request, res: Response) {
    try {
      const { fingerprintId, scheduleId, timestamp } = req.body || {};
      if (!fingerprintId || typeof fingerprintId !== 'string') {
        return res.status(400).json({ status: 'error', message: 'fingerprintId is required' });
      }

      const now = timestamp ? new Date(timestamp) : new Date();

      // Find student by fingerprintId
      const student = await attendanceService.findStudentByFingerprintId(fingerprintId);

      // Process attendance using shared service
      const result = await attendanceService.processAttendanceScan(student, scheduleId, now);

      return res.json({ status: 'success', data: result });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({ status: 'error', code: error.code, message: error.message || 'Failed to process fingerprint scan' });
    }
  }

  // Get all attendance records with pagination and filters
  async getAllAttendance(req: Request, res: Response) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        scheduleId = '',
        studentId = '',
        status = '',
        startDate = '',
        endDate = '',
        centerId = '',
        sortBy = 'createdAt',
        sortOrder = 'DESC',
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      const queryBuilder = this.attendanceRepository
        .createQueryBuilder('attendance')
        .leftJoinAndSelect('attendance.student', 'student')
        .leftJoinAndSelect('student.user', 'studentUser')
        .leftJoinAndSelect('attendance.schedule', 'schedule')
        .leftJoinAndSelect('schedule.module', 'module')
        .leftJoinAndSelect('schedule.batch', 'batch')
        .leftJoinAndSelect('schedule.center', 'center')
        .skip(skip)
        .take(Number(limit))
        .orderBy(`attendance.${sortBy}`, sortOrder as 'ASC' | 'DESC');

      // Search filter
      if (search) {
        queryBuilder.where(
          '(studentUser.firstName ILIKE :search OR studentUser.lastName ILIKE :search OR module.moduleName ILIKE :search)',
          { search: `%${search}%` }
        );
      }

      // Schedule filter
      if (scheduleId) {
        queryBuilder.andWhere('attendance.scheduleId = :scheduleId', { scheduleId });
      }

      // Student filter
      if (studentId) {
        queryBuilder.andWhere('attendance.studentId = :studentId', { studentId });
      }

      // Status filter
      if (status) {
        queryBuilder.andWhere('attendance.status = :status', { status });
      }

      // Center filter
      if (centerId) {
        queryBuilder.andWhere('schedule.centerId = :centerId', { centerId });
      }

      // Date range filter
      if (startDate && endDate) {
        queryBuilder.andWhere('schedule.date BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        });
      }

      const [attendances, total] = await queryBuilder.getManyAndCount();

      res.json({
        status: 'success',
        data: {
          attendances,
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
        message: error.message || 'Failed to fetch attendance records',
      });
    }
  }

  // Get attendance by ID
  async getAttendanceById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const attendance = await this.attendanceRepository.findOne({
        where: { id },
        relations: [
          'student',
          'student.user',
          'schedule',
          'schedule.module',
          'schedule.batch',
          'schedule.lecturer',
          'schedule.lecturer.user',
        ],
      });

      if (!attendance) {
        return res.status(404).json({
          status: 'error',
          message: 'Attendance record not found',
        });
      }

      res.json({
        status: 'success',
        data: { attendance },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch attendance record',
      });
    }
  }

  // Mark attendance for a schedule
  async markAttendance(req: Request, res: Response) {
    try {
      const { scheduleId, attendanceData } = req.body;

      // Verify schedule exists
      const schedule = await this.scheduleRepository.findOne({
        where: { id: scheduleId },
        relations: ['batch', 'module'],
      });

      if (!schedule) {
        return res.status(404).json({
          status: 'error',
          message: 'Schedule not found',
        });
      }

      // Get all enrolled students for this batch
      const enrollments = await this.enrollmentRepository.find({
        where: {
          batch: { id: schedule.batch.id },
          status: 'ACTIVE' as any,
        },
        relations: ['student'],
      });

      const results: {
        success: Array<{ studentId: string; status: string }>;
        failed: Array<{ studentId: string; error: string }>;
      } = {
        success: [],
        failed: [],
      };

      // Process each attendance record
      for (const record of attendanceData) {
        try {
          const { studentId, status, remarks } = record;

          // Verify student exists
          const student = await this.studentRepository.findOne({
            where: { id: studentId },
          });

          if (!student) {
            results.failed.push({
              studentId,
              error: 'Student not found',
            });
            continue;
          }

          // Check if attendance already exists
          let attendance = await this.attendanceRepository.findOne({
            where: {
              student: { id: studentId },
              schedule: { id: scheduleId },
            },
          });

          if (attendance) {
            // Update existing attendance
            attendance.status = status;
            attendance.remarks = remarks || null;
            attendance.markedAt = new Date();
          } else {
            // Create new attendance
            attendance = this.attendanceRepository.create({
              status,
              remarks: remarks || null,
              markedAt: new Date(),
            });
            attendance.student = student;
            attendance.schedule = schedule;
          }

          await this.attendanceRepository.save(attendance);
          results.success.push({
            studentId,
            status: 'marked',
          });
        } catch (error: any) {
          results.failed.push({
            studentId: record.studentId,
            error: error.message,
          });
        }
      }

      res.json({
        status: 'success',
        message: `Attendance marked for ${results.success.length} students`,
        data: results,
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to mark attendance',
      });
    }
  }

  // Get attendance for a specific schedule
  async getScheduleAttendance(req: Request, res: Response) {
    try {
      const { scheduleId } = req.params;

      const schedule = await this.scheduleRepository.findOne({
        where: { id: scheduleId },
        relations: ['batch', 'module'],
      });

      if (!schedule) {
        return res.status(404).json({
          status: 'error',
          message: 'Schedule not found',
        });
      }

      // Get all enrolled students for this batch
      const enrollments = await this.enrollmentRepository.find({
        where: {
          batch: { id: schedule.batch.id },
          status: 'ACTIVE' as any,
        },
        relations: ['student', 'student.user'],
      });

      // Get existing attendance records
      const attendances = await this.attendanceRepository.find({
        where: { schedule: { id: scheduleId } },
        relations: ['student', 'student.user'],
      });

      // Create a map of attendance by student ID
      const attendanceMap = new Map(attendances.map(att => [att.student.id, att]));

      // Build complete student list with attendance status
      const studentAttendance = enrollments.map(enrollment => {
        const attendance = attendanceMap.get(enrollment.student.id);
        return {
          student: enrollment.student,
          attendance: attendance || null,
          marked: !!attendance,
        };
      });

      // Calculate statistics
      const stats = {
        total: studentAttendance.length,
        present: attendances.filter(a => a.status === AttendanceStatus.PRESENT).length,
        absent: attendances.filter(a => a.status === AttendanceStatus.ABSENT).length,
        late: attendances.filter(a => a.status === AttendanceStatus.LATE).length,
        excused: attendances.filter(a => a.status === AttendanceStatus.EXCUSED).length,
        unmarked: studentAttendance.length - attendances.length,
      };

      res.json({
        status: 'success',
        data: {
          schedule,
          students: studentAttendance,
          stats,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch schedule attendance',
      });
    }
  }

  // Get student attendance report
  async getStudentAttendanceReport(req: Request, res: Response) {
    try {
      const { studentId } = req.params;
      const { startDate, endDate, moduleId } = req.query;

      const student = await this.studentRepository.findOne({
        where: { id: studentId },
        relations: ['user', 'enrollments', 'enrollments.batch'],
      });

      if (!student) {
        return res.status(404).json({
          status: 'error',
          message: 'Student not found',
        });
      }

      const queryBuilder = this.attendanceRepository
        .createQueryBuilder('attendance')
        .leftJoinAndSelect('attendance.schedule', 'schedule')
        .leftJoinAndSelect('schedule.module', 'module')
        .leftJoinAndSelect('schedule.batch', 'batch')
        .where('attendance.studentId = :studentId', { studentId })
        .orderBy('schedule.date', 'DESC');

      if (startDate && endDate) {
        queryBuilder.andWhere('schedule.date BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        });
      }

      if (moduleId) {
        queryBuilder.andWhere('schedule.moduleId = :moduleId', { moduleId });
      }

      const attendances = await queryBuilder.getMany();

      // Calculate statistics
      const total = attendances.length;
      const present = attendances.filter(a => a.status === AttendanceStatus.PRESENT).length;
      const absent = attendances.filter(a => a.status === AttendanceStatus.ABSENT).length;
      const late = attendances.filter(a => a.status === AttendanceStatus.LATE).length;
      const excused = attendances.filter(a => a.status === AttendanceStatus.EXCUSED).length;

      const stats = {
        total,
        present,
        absent,
        late,
        excused,
        attendanceRate: total > 0 ? ((present / total) * 100).toFixed(2) : '0',
      };

      res.json({
        status: 'success',
        data: {
          student,
          attendances,
          stats,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to generate attendance report',
      });
    }
  }

  // Get attendance statistics
  async getAttendanceStats(req: Request, res: Response) {
    try {
      // Auto-complete finished schedules before fetching stats
      await this.autoCompleteFinishedSchedules();

      const totalRecords = await this.attendanceRepository.count();

      const presentCount = await this.attendanceRepository.count({
        where: { status: AttendanceStatus.PRESENT },
      });

      const absentCount = await this.attendanceRepository.count({
        where: { status: AttendanceStatus.ABSENT },
      });

      const lateCount = await this.attendanceRepository.count({
        where: { status: AttendanceStatus.LATE },
      });

      const excusedCount = await this.attendanceRepository.count({
        where: { status: AttendanceStatus.EXCUSED },
      });

      // Get today's attendance
      const today = new Date().toISOString().split('T')[0];
      const todaySchedules = await this.scheduleRepository.find({
        where: { date: new Date(today) },
      });

      const todayAttendance = await this.attendanceRepository.count({
        where: {
          schedule: {
            id: todaySchedules.length > 0 ? todaySchedules[0].id : undefined,
          },
        },
      });

      // Calculate overall attendance rate
      const attendanceRate =
        totalRecords > 0 ? ((presentCount / totalRecords) * 100).toFixed(2) : '0';

      res.json({
        status: 'success',
        data: {
          totalRecords,
          presentCount,
          absentCount,
          lateCount,
          excusedCount,
          todayAttendance: todaySchedules.length,
          attendanceRate,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch statistics',
      });
    }
  }

  // Update attendance record
  async updateAttendance(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status, remarks } = req.body;

      const attendance = await this.attendanceRepository.findOne({
        where: { id },
      });

      if (!attendance) {
        return res.status(404).json({
          status: 'error',
          message: 'Attendance record not found',
        });
      }

      if (status) attendance.status = status;
      if (remarks !== undefined) attendance.remarks = remarks;
      attendance.markedAt = new Date();

      await this.attendanceRepository.save(attendance);

      // Fetch updated attendance with relations
      const updatedAttendance = await this.attendanceRepository.findOne({
        where: { id },
        relations: ['student', 'student.user', 'schedule', 'schedule.module'],
      });

      res.json({
        status: 'success',
        message: 'Attendance updated successfully',
        data: { attendance: updatedAttendance },
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to update attendance',
      });
    }
  }

  // Delete attendance record
  async deleteAttendance(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const attendance = await this.attendanceRepository.findOne({
        where: { id },
      });

      if (!attendance) {
        return res.status(404).json({
          status: 'error',
          message: 'Attendance record not found',
        });
      }

      await this.attendanceRepository.remove(attendance);

      res.json({
        status: 'success',
        message: 'Attendance record deleted successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to delete attendance',
      });
    }
  }

  // Get batch attendance summary
  async getBatchAttendanceSummary(req: Request, res: Response) {
    try {
      const { batchId } = req.params;
      const { startDate, endDate } = req.query;

      // Get all students in batch
      const enrollments = await this.enrollmentRepository.find({
        where: {
          batch: { id: batchId },
          status: 'ACTIVE' as any,
        },
        relations: ['student', 'student.user'],
      });

      // Get schedules for the batch
      const schedulesQuery = this.scheduleRepository
        .createQueryBuilder('schedule')
        .where('schedule.batchId = :batchId', { batchId });

      if (startDate && endDate) {
        schedulesQuery.andWhere('schedule.date BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        });
      }

      const schedules = await schedulesQuery.getMany();

      // Get attendance for each student
      const summary = await Promise.all(
        enrollments.map(async enrollment => {
          const attendances = await this.attendanceRepository
            .createQueryBuilder('attendance')
            .leftJoinAndSelect('attendance.schedule', 'schedule')
            .where('attendance.studentId = :studentId', {
              studentId: enrollment.student.id,
            })
            .andWhere('schedule.batchId = :batchId', { batchId })
            .getMany();

          const present = attendances.filter(a => a.status === AttendanceStatus.PRESENT).length;
          const total = schedules.length;
          const rate = total > 0 ? ((present / total) * 100).toFixed(2) : '0';

          return {
            student: enrollment.student,
            stats: {
              total: attendances.length,
              present,
              absent: attendances.filter(a => a.status === AttendanceStatus.ABSENT).length,
              late: attendances.filter(a => a.status === AttendanceStatus.LATE).length,
              attendanceRate: rate,
            },
          };
        })
      );

      res.json({
        status: 'success',
        data: {
          totalSchedules: schedules.length,
          students: summary,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch batch attendance summary',
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
}

export default new AttendanceController();
