import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Enrollment } from '../entities/Enrollment.entity';
import { Student } from '../entities/Student.entity';
import { Program } from '../entities/Program.entity';
import { Batch } from '../entities/Batch.entity';
import { EnrollmentStatus } from '../enums/EnrollmentStatus.enum';

export class EnrollmentController {
  private enrollmentRepository = AppDataSource.getRepository(Enrollment);
  private studentRepository = AppDataSource.getRepository(Student);
  private programRepository = AppDataSource.getRepository(Program);
  private batchRepository = AppDataSource.getRepository(Batch);

  // Get all enrollments with pagination and filters
  async getAllEnrollments(req: Request, res: Response) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        status,
        programId,
        batchId,
        studentId,
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      const queryBuilder = this.enrollmentRepository
        .createQueryBuilder('enrollment')
        .leftJoinAndSelect('enrollment.student', 'student')
        .leftJoinAndSelect('student.user', 'user')
        .leftJoinAndSelect('enrollment.program', 'program')
        .leftJoinAndSelect('enrollment.batch', 'batch')
        .skip(skip)
        .take(Number(limit))
        .orderBy('enrollment.createdAt', 'DESC');

      // Search filter (by student name or university number)
      if (search) {
        queryBuilder.andWhere(
          '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR student.universityNumber ILIKE :search)',
          { search: `%${search}%` }
        );
      }

      // Status filter
      if (status) {
        queryBuilder.andWhere('enrollment.status = :status', { status });
      }

      // Program filter
      if (programId) {
        queryBuilder.andWhere('program.id = :programId', { programId });
      }

      // Batch filter
      if (batchId) {
        queryBuilder.andWhere('batch.id = :batchId', { batchId });
      }

      // Student filter
      if (studentId) {
        queryBuilder.andWhere('student.id = :studentId', { studentId });
      }

      const [enrollments, total] = await queryBuilder.getManyAndCount();

      res.json({
        status: 'success',
        data: {
          enrollments,
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
        message: error.message || 'Failed to fetch enrollments',
      });
    }
  }

  // Get enrollment by ID
  async getEnrollmentById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const enrollment = await this.enrollmentRepository.findOne({
        where: { id },
        relations: ['student', 'student.user', 'program', 'batch'],
      });

      if (!enrollment) {
        return res.status(404).json({
          status: 'error',
          message: 'Enrollment not found',
        });
      }

      res.json({
        status: 'success',
        data: { enrollment },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch enrollment',
      });
    }
  }

  // Create new enrollment
  async createEnrollment(req: Request, res: Response) {
    try {
      const { studentId, programId, batchId, enrollmentDate, status } = req.body;

      // Check if student exists
      const student = await this.studentRepository.findOne({ where: { id: studentId } });
      if (!student) {
        return res.status(404).json({ status: 'error', message: 'Student not found' });
      }

      // Check if program exists
      const program = await this.programRepository.findOne({ where: { id: programId } });
      if (!program) {
        return res.status(404).json({ status: 'error', message: 'Program not found' });
      }

      // Check if batch exists
      const batch = await this.batchRepository.findOne({ where: { id: batchId } });
      if (!batch) {
        return res.status(404).json({ status: 'error', message: 'Batch not found' });
      }

      // Check if already enrolled in this program and batch
      const existingEnrollment = await this.enrollmentRepository.findOne({
        where: {
          student: { id: studentId },
          program: { id: programId },
          batch: { id: batchId },
        },
      });

      if (existingEnrollment) {
        return res.status(400).json({
          status: 'error',
          message: 'Student is already enrolled in this program and batch',
        });
      }

      const enrollment = this.enrollmentRepository.create({
        student,
        program,
        batch,
        enrollmentDate: enrollmentDate || new Date(),
        status: status || EnrollmentStatus.ACTIVE,
      });

      const savedEnrollment = await this.enrollmentRepository.save(enrollment);

      res.status(201).json({
        status: 'success',
        message: 'Enrollment created successfully',
        data: { enrollment: savedEnrollment },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to create enrollment',
      });
    }
  }

  // Update enrollment
  async updateEnrollment(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { batchId, enrollmentDate, status } = req.body;

      const enrollment = await this.enrollmentRepository.findOne({ where: { id } });
      if (!enrollment) {
        return res.status(404).json({ status: 'error', message: 'Enrollment not found' });
      }

      if (batchId) {
        const batch = await this.batchRepository.findOne({ where: { id: batchId } });
        if (!batch) {
          return res.status(404).json({ status: 'error', message: 'Batch not found' });
        }
        enrollment.batch = batch;
      }

      if (enrollmentDate) {
        enrollment.enrollmentDate = enrollmentDate;
      }

      if (status) {
        enrollment.status = status;
      }

      const updatedEnrollment = await this.enrollmentRepository.save(enrollment);

      res.json({
        status: 'success',
        message: 'Enrollment updated successfully',
        data: { enrollment: updatedEnrollment },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to update enrollment',
      });
    }
  }

  // Delete enrollment
  async deleteEnrollment(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const enrollment = await this.enrollmentRepository.findOne({ where: { id } });
      if (!enrollment) {
        return res.status(404).json({ status: 'error', message: 'Enrollment not found' });
      }

      await this.enrollmentRepository.remove(enrollment);

      res.json({
        status: 'success',
        message: 'Enrollment deleted successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to delete enrollment',
      });
    }
  }
}
