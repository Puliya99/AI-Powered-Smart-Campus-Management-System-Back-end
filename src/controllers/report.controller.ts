import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Student } from '../entities/Student.entity';
import { Payment } from '../entities/Payment.entity';
import { Attendance } from '../entities/Attendance.entity';
import { Enrollment } from '../entities/Enrollment.entity';
import { Program } from '../entities/Program.entity';
import { Batch } from '../entities/Batch.entity';

export class ReportController {
  private studentRepository = AppDataSource.getRepository(Student);
  private paymentRepository = AppDataSource.getRepository(Payment);
  private attendanceRepository = AppDataSource.getRepository(Attendance);
  private enrollmentRepository = AppDataSource.getRepository(Enrollment);
  private programRepository = AppDataSource.getRepository(Program);
  private batchRepository = AppDataSource.getRepository(Batch);

  // Enrollment Report
  async getEnrollmentReport(req: Request, res: Response) {
    try {
      const { centerId } = req.query;

      const queryBuilder = this.enrollmentRepository
        .createQueryBuilder('enrollment')
        .leftJoinAndSelect('enrollment.student', 'student')
        .leftJoinAndSelect('student.user', 'user')
        .leftJoinAndSelect('enrollment.batch', 'batch')
        .leftJoinAndSelect('batch.program', 'program')
        .leftJoin('batch.centers', 'center')
        .select([
          'enrollment.id',
          'enrollment.enrollmentDate',
          'enrollment.status',
          'student.id',
          'user.firstName',
          'user.lastName',
          'batch.batchNumber',
          'program.programName',
        ]);

      if (centerId) {
        queryBuilder.andWhere('center.id = :centerId', { centerId });
      }

      const report = await queryBuilder.getMany();

      res.json({
        status: 'success',
        data: report,
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch enrollment report',
      });
    }
  }

  // Payment Report
  async getPaymentReport(req: Request, res: Response) {
    try {
      const { startDate, endDate, centerId } = req.query;

      const queryBuilder = this.paymentRepository
        .createQueryBuilder('payment')
        .leftJoinAndSelect('payment.student', 'student')
        .leftJoinAndSelect('student.user', 'user')
        .leftJoinAndSelect('payment.program', 'program')
        .leftJoinAndSelect('payment.center', 'center');

      if (startDate && endDate) {
        queryBuilder.where('payment.paymentDate BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        });
      }

      if (centerId) {
        queryBuilder.andWhere('payment.center = :centerId', { centerId });
      }

      const report = await queryBuilder.getMany();

      res.json({
        status: 'success',
        data: report,
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch payment report',
      });
    }
  }

  // Attendance Report
  async getAttendanceReport(req: Request, res: Response) {
    try {
      const { batchId, centerId } = req.query;

      const queryBuilder = this.attendanceRepository
        .createQueryBuilder('attendance')
        .leftJoinAndSelect('attendance.student', 'student')
        .leftJoinAndSelect('student.user', 'user')
        .leftJoinAndSelect('attendance.schedule', 'schedule')
        .leftJoinAndSelect('schedule.batch', 'batch')
        .leftJoinAndSelect('schedule.module', 'module')
        .leftJoinAndSelect('schedule.center', 'center');

      if (batchId) {
        queryBuilder.where('batch.id = :batchId', { batchId });
      }

      if (centerId) {
        queryBuilder.andWhere('center.id = :centerId', { centerId });
      }

      const report = await queryBuilder.getMany();

      res.json({
        status: 'success',
        data: report,
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch attendance report',
      });
    }
  }

  // Summary Stats for Reports
  async getReportStats(req: Request, res: Response) {
    try {
      const { centerId } = req.query;

      const studentQuery = this.studentRepository.createQueryBuilder('student');
      const programQuery = this.programRepository.createQueryBuilder('program');
      const batchQuery = this.batchRepository.createQueryBuilder('batch');
      const paymentQuery = this.paymentRepository.createQueryBuilder('payment');

      if (centerId) {
        studentQuery.leftJoin('student.user', 'user').where('user.center = :centerId', { centerId });
        programQuery.leftJoin('program.centers', 'center').where('center.id = :centerId', { centerId });
        batchQuery.leftJoin('batch.centers', 'center').where('center.id = :centerId', { centerId });
        paymentQuery.andWhere('payment.center = :centerId', { centerId });
      }

      const totalStudents = await studentQuery.getCount();
      const totalPrograms = await programQuery.getCount();
      const totalBatches = await batchQuery.getCount();
      
      const paymentStats = await paymentQuery
        .select('SUM(payment.amount)', 'totalRevenue')
        .getRawOne();

      res.json({
        status: 'success',
        data: {
          totalStudents,
          totalPrograms,
          totalBatches,
          totalRevenue: parseFloat(paymentStats.totalRevenue || '0'),
        },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch report stats',
      });
    }
  }
}

export default new ReportController();
