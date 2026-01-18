import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Module } from '../entities/Module.entity';
import { Lecturer } from '../entities/Lecturer.entity';
import { Result } from '../entities/Result.entity';
import { Attendance } from '../entities/Attendance.entity';
import { LectureNote } from '../entities/LectureNote.entity';
import { Assignment } from '../entities/Assignment.entity';
import { Submission } from '../entities/Submission.entity';
import { Feedback } from '../entities/Feedback.entity';
import { Schedule } from '../entities/Schedule.entity';
import { Role } from '../enums/Role.enum';
import { ScheduleStatus } from '../enums/ScheduleStatus.enum';
import { Prediction } from '../entities/Prediction.entity';
import { RiskLevel } from '../enums/RiskLevel.enum';
import { Batch } from '../entities/Batch.entity';
import { User } from '../entities/User.entity';

export class PerformanceController {
  private moduleRepository = AppDataSource.getRepository(Module);
  private lecturerRepository = AppDataSource.getRepository(Lecturer);
  private resultRepository = AppDataSource.getRepository(Result);
  private attendanceRepository = AppDataSource.getRepository(Attendance);
  private lectureNoteRepository = AppDataSource.getRepository(LectureNote);
  private assignmentRepository = AppDataSource.getRepository(Assignment);
  private submissionRepository = AppDataSource.getRepository(Submission);
  private feedbackRepository = AppDataSource.getRepository(Feedback);
  private scheduleRepository = AppDataSource.getRepository(Schedule);
  private predictionRepository = AppDataSource.getRepository(Prediction);
  private batchRepository = AppDataSource.getRepository(Batch);

  // Get performance metrics for a specific module
  async getModulePerformance(req: Request, res: Response) {
    try {
      const { moduleId } = req.params;

      // Auto-complete finished schedules before fetching metrics
      await this.autoCompleteFinishedSchedules();

      const module = await this.moduleRepository.findOne({
        where: { id: moduleId },
        relations: ['lecturer', 'lecturer.user']
      });

      if (!module) {
        return res.status(404).json({ status: 'error', message: 'Module not found' });
      }

      // 1. Academic Performance (Results)
      const results = await this.resultRepository.find({ where: { module: { id: moduleId } } });
      const avgMarks = results.length > 0 
        ? results.reduce((acc, r) => acc + (r.marks / r.maxMarks) * 100, 0) / results.length 
        : 0;
      const passRate = results.length > 0
        ? (results.filter(r => r.status === 'PASS').length / results.length) * 100
        : 0;

      // 2. Student Engagement (Attendance)
      const attendance = await this.attendanceRepository.find({
        where: { schedule: { module: { id: moduleId } } }
      });
      const attendanceRate = attendance.length > 0
        ? (attendance.filter(a => a.status === 'PRESENT' as any).length / attendance.length) * 100
        : 0;

      // 3. Content Delivery (Lecture Notes)
      const materialCount = await this.lectureNoteRepository.count({ where: { module: { id: moduleId } } });

      // 4. Assignments
      const assignments = await this.assignmentRepository.find({ where: { module: { id: moduleId } } });
      const assignmentCount = assignments.length;
      
      let submissionRate = 0;
      if (assignmentCount > 0) {
          // This is a bit simplified, ideally we'd compare with total enrolled students
          const totalSubmissions = await this.submissionRepository.count({
              where: { assignment: { module: { id: moduleId } } }
          });
          // Assuming we want an average submission rate per assignment
          // For now, let's just return the total count or something useful
          submissionRate = totalSubmissions; 
      }

      // 5. Student Feedback
      const feedbacks = await this.feedbackRepository.find({ where: { module: { id: moduleId } } });
      const avgRating = feedbacks.length > 0
        ? feedbacks.reduce((acc, f) => acc + (f.rating || 0), 0) / feedbacks.length
        : 0;

      res.json({
        status: 'success',
        data: {
          module: {
            id: module.id,
            moduleCode: module.moduleCode,
            moduleName: module.moduleName,
            lecturerName: `${module.lecturer.user.firstName} ${module.lecturer.user.lastName}`
          },
          metrics: {
            academic: {
              avgMarks: parseFloat(avgMarks.toFixed(2)),
              passRate: parseFloat(passRate.toFixed(2)),
              totalResults: results.length
            },
            engagement: {
              attendanceRate: parseFloat(attendanceRate.toFixed(2)),
              totalAttendanceRecords: attendance.length
            },
            delivery: {
              materialCount,
              assignmentCount,
              totalSubmissions: submissionRate
            },
            feedback: {
              avgRating: parseFloat(avgRating.toFixed(2)),
              totalFeedbacks: feedbacks.length
            }
          }
        }
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  // Get aggregated performance for a lecturer
  async getLecturerPerformance(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;

      // Auto-complete finished schedules before fetching metrics
      await this.autoCompleteFinishedSchedules();

      const lecturer = await this.lecturerRepository.findOne({
        where: { user: { id: userId } },
        relations: ['modules']
      });

      if (!lecturer) {
        return res.status(404).json({ status: 'error', message: 'Lecturer profile not found' });
      }

      const modulePerformances = await Promise.all(
        lecturer.modules.map(async (m) => {
          // Similar logic as getModulePerformance but aggregated
          const results = await this.resultRepository.find({ where: { module: { id: m.id } } });
          const avgMarks = results.length > 0 
            ? results.reduce((acc, r) => acc + (r.marks / r.maxMarks) * 100, 0) / results.length 
            : 0;

          const attendance = await this.attendanceRepository.find({
            where: { schedule: { module: { id: m.id } } }
          });
          const attendanceRate = attendance.length > 0
            ? (attendance.filter(a => a.status === 'PRESENT' as any).length / attendance.length) * 100
            : 0;

          const feedbacks = await this.feedbackRepository.find({ where: { module: { id: m.id } } });
          const avgRating = feedbacks.length > 0
            ? feedbacks.reduce((acc, f) => acc + (f.rating || 0), 0) / feedbacks.length
            : 0;

          return {
            moduleId: m.id,
            moduleCode: m.moduleCode,
            moduleName: m.moduleName,
            avgMarks: parseFloat(avgMarks.toFixed(2)),
            attendanceRate: parseFloat(attendanceRate.toFixed(2)),
            avgRating: parseFloat(avgRating.toFixed(2))
          };
        })
      );

      res.json({
        status: 'success',
        data: {
          lecturerId: lecturer.id,
          modules: modulePerformances
        }
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  // Admin view: Performance of all lecturers
  async getAllLecturersPerformance(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      let { centerId } = req.query;

      // Logic to restrict based on role
      if (user.role !== Role.ADMIN) {
        // Non-admins only see lecturers in their own center
        const userWithCenter = await AppDataSource.getRepository(User).findOne({
          where: { id: user.userId },
          relations: ['center']
        });
        
        if (!userWithCenter || !userWithCenter.center) {
          return res.status(403).json({ status: 'error', message: 'User is not assigned to a center' });
        }
        
        centerId = userWithCenter.center.id;
      }

      // Auto-complete finished schedules before fetching metrics
      await this.autoCompleteFinishedSchedules();

      const whereClause: any = {};
      if (centerId) {
        whereClause.user = { center: { id: centerId } };
      }

      const lecturers = await this.lecturerRepository.find({
        where: whereClause,
        relations: ['user', 'user.center', 'modules', 'centers']
      });

      const performanceData = (await Promise.all(
        lecturers.map(async (l) => {
          // If a centerId filter is active, ensure this lecturer is actually assigned to that center
          // even if the user filter worked, we double check assignments if needed.
          if (centerId) {
             const isAssignedToCenter = l.centers.some(c => c.id === centerId);
             if (!isAssignedToCenter && l.user.center?.id !== centerId) {
                return null;
             }
          }

          const materialsCount = await this.lectureNoteRepository.count({ where: { lecturer: { id: l.id } } });
          
          // Get all results for all modules of this lecturer
          const moduleIds = l.modules.map(m => m.id);
          let avgMarks = 0;
          let avgAttendance = 0;
          let avgRating = 0;

          if (moduleIds.length > 0) {
            const results = await this.resultRepository.createQueryBuilder('result')
              .where('result.moduleId IN (:...ids)', { ids: moduleIds })
              .getMany();
            
            avgMarks = results.length > 0 
              ? results.reduce((acc, r) => acc + (r.marks / r.maxMarks) * 100, 0) / results.length 
              : 0;

            const attendance = await this.attendanceRepository.createQueryBuilder('attendance')
              .leftJoin('attendance.schedule', 'schedule')
              .where('schedule.moduleId IN (:...ids)', { ids: moduleIds })
              .getMany();
            
            avgAttendance = attendance.length > 0
              ? (attendance.filter(a => a.status === 'PRESENT' as any).length / attendance.length) * 100
              : 0;

            const feedbacks = await this.feedbackRepository.createQueryBuilder('feedback')
              .where('feedback.moduleId IN (:...ids)', { ids: moduleIds })
              .getMany();
            
            avgRating = feedbacks.length > 0
              ? feedbacks.reduce((acc, f) => acc + (f.rating || 0), 0) / feedbacks.length
              : 0;
          }

          return {
            lecturerId: l.id,
            name: `${l.user.firstName} ${l.user.lastName}`,
            moduleCount: l.modules.length,
            materialsCount,
            avgMarks: parseFloat(avgMarks.toFixed(2)),
            avgAttendance: parseFloat(avgAttendance.toFixed(2)),
            avgRating: parseFloat(avgRating.toFixed(2))
          };
        })
      )).filter(data => data !== null);

      res.json({
        status: 'success',
        data: performanceData
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  // Get performance metrics for a specific batch
  async getBatchPerformance(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { batchId } = req.params;

      const batch = await this.batchRepository.findOne({
        where: { id: batchId },
        relations: ['program', 'enrollments', 'enrollments.student', 'centers']
      });

      if (!batch) {
        return res.status(404).json({ status: 'error', message: 'Batch not found' });
      }

      // Logic to restrict based on role
      if (user.role !== Role.ADMIN) {
        // Non-admins only see batches in their own center
        const userWithCenter = await AppDataSource.getRepository(User).findOne({
          where: { id: user.userId },
          relations: ['center']
        });
        
        if (!userWithCenter || !userWithCenter.center) {
          return res.status(403).json({ status: 'error', message: 'User is not assigned to a center' });
        }
        
        const isCenterBatch = batch.centers.some(c => c.id === userWithCenter.center.id);
        if (!isCenterBatch) {
          return res.status(403).json({ status: 'error', message: 'Access denied. This batch is not in your center.' });
        }
      }

      const modulePerformances = await this.moduleRepository.find({
        where: { program: { id: batch.program.id } }
      });

      const metrics = await Promise.all(modulePerformances.map(async (m) => {
        const results = await this.resultRepository.createQueryBuilder('result')
          .innerJoin('result.student', 'student')
          .innerJoin('student.enrollments', 'enrollment')
          .where('result.moduleId = :moduleId', { moduleId: m.id })
          .andWhere('enrollment.batchId = :batchId', { batchId })
          .getMany();

        const avgMarks = results.length > 0 
          ? results.reduce((acc, r) => acc + (r.marks / r.maxMarks) * 100, 0) / results.length 
          : 0;

        const attendance = await this.attendanceRepository.createQueryBuilder('attendance')
          .innerJoin('attendance.schedule', 'schedule')
          .where('schedule.moduleId = :moduleId', { moduleId: m.id })
          .andWhere('schedule.batchId = :batchId', { batchId })
          .getMany();

        const attendanceRate = attendance.length > 0
          ? (attendance.filter(a => a.status === 'PRESENT' as any).length / attendance.length) * 100
          : 0;

        return {
          moduleId: m.id,
          moduleCode: m.moduleCode,
          moduleName: m.moduleName,
          avgMarks: parseFloat(avgMarks.toFixed(2)),
          attendanceRate: parseFloat(attendanceRate.toFixed(2))
        };
      }));

      res.json({
        status: 'success',
        data: {
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          programName: batch.program.programName,
          metrics
        }
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  // Get AI predictions for a center (Admin sees all centers, user sees his center)
  async getCenterPredictions(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      let centerId = req.query.centerId as string;

      // Authorization logic
      if (user.role !== Role.ADMIN) {
        // Non-admins can only see their own center
        const userWithCenter = await AppDataSource.getRepository(User).findOne({
          where: { id: user.userId },
          relations: ['center']
        });
        
        if (!userWithCenter || !userWithCenter.center) {
          return res.status(403).json({ status: 'error', message: 'User is not assigned to a center' });
        }
        
        centerId = userWithCenter.center.id;
      }

      if (!centerId && user.role === Role.ADMIN) {
         // Admin might want all centers if centerId is not provided, 
         // but the requirement says "admin center wise", so maybe we expect a centerId or return all grouped by center.
         // Let's return for all if not specified, or just error if required.
         // Given "Performance AI Prediction should be visible only to the admin center wise", 
         // I'll return predictions for all students if centerId is missing for admin, but it's better to group them.
      }

      const query = this.predictionRepository.createQueryBuilder('prediction')
        .innerJoinAndSelect('prediction.student', 'student')
        .innerJoinAndSelect('student.user', 'user')
        .leftJoinAndSelect('user.center', 'center');

      if (centerId) {
        query.where('center.id = :centerId', { centerId });
      }

      const predictions = await query.orderBy('prediction.createdAt', 'DESC').getMany();

      // Aggregate stats for center
      const highRiskCount = predictions.filter(p => p.riskLevel === RiskLevel.HIGH).length;
      const mediumRiskCount = predictions.filter(p => p.riskLevel === RiskLevel.MEDIUM).length;
      const lowRiskCount = predictions.filter(p => p.riskLevel === RiskLevel.LOW).length;

      res.json({
        status: 'success',
        data: {
          centerId,
          total: predictions.length,
          stats: {
            highRisk: highRiskCount,
            mediumRisk: mediumRiskCount,
            lowRisk: lowRiskCount
          },
          predictions
        }
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
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

export default new PerformanceController();
