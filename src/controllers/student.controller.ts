import { Request, Response } from 'express';
import * as xlsx from 'xlsx';
import { AppDataSource } from '../config/database';
import { Student } from '../entities/Student.entity';
import { User } from '../entities/User.entity';
import { Enrollment } from '../entities/Enrollment.entity';
import { Center } from '../entities/Center.entity';
import { Batch } from '../entities/Batch.entity';
import { Program } from '../entities/Program.entity';
import { Schedule } from '../entities/Schedule.entity';
import { WebAuthnCredential } from '../entities/WebAuthnCredential.entity';
import { Prediction } from '../entities/Prediction.entity';
import { Attendance } from '../entities/Attendance.entity';
import { Payment } from '../entities/Payment.entity';
import { Result } from '../entities/Result.entity';
import { Feedback } from '../entities/Feedback.entity';
import { Submission } from '../entities/Submission.entity';
import { QuizAttempt } from '../entities/QuizAttempt.entity';
import { QuizViolation } from '../entities/QuizViolation.entity';
import { RepeatExamEnrollment } from '../entities/RepeatExamEnrollment.entity';
import { MeetingParticipant } from '../entities/MeetingParticipant.entity';
import { Borrowing } from '../entities/Borrowing.entity';
import { Notification } from '../entities/Notification.entity';
import emailService from '../services/email.service';
import attendanceService from '../services/attendance.service';
import { env } from '../config/env';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';

// In-memory challenge store for WebAuthn registration
const registrationChallenges = new Map<string, { challenge: string; expiresAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of registrationChallenges.entries()) {
    if (now > value.expiresAt) registrationChallenges.delete(key);
  }
}, 60000);

export class StudentController {
  private studentRepository = AppDataSource.getRepository(Student);
  private userRepository = AppDataSource.getRepository(User);
  private enrollmentRepository = AppDataSource.getRepository(Enrollment);
  private centerRepository = AppDataSource.getRepository(Center);
  private batchRepository = AppDataSource.getRepository(Batch);
  private programRepository = AppDataSource.getRepository(Program);
  private credentialRepository = AppDataSource.getRepository(WebAuthnCredential);

  // Get all students with pagination and filters
  async getAllStudents(req: Request, res: Response) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        paymentType,
        isActive,
        centerId,
        batchId,
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      const queryBuilder = this.studentRepository
        .createQueryBuilder('student')
        .leftJoinAndSelect('student.user', 'user')
        .leftJoinAndSelect('user.center', 'center')
        .leftJoinAndSelect('student.enrollments', 'enrollments')
        .leftJoinAndSelect('enrollments.program', 'program')
        .leftJoinAndSelect('enrollments.batch', 'batch')
        .skip(skip)
        .take(Number(limit));

      // Search filter
      if (search) {
        queryBuilder.where(
          '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search OR student.universityNumber ILIKE :search)',
          { search: `%${search}%` }
        );
      }

      // Payment type filter
      if (paymentType) {
        queryBuilder.andWhere('student.paymentType = :paymentType', {
          paymentType,
        });
      }

      // Active status filter
      if (isActive !== undefined) {
        queryBuilder.andWhere('user.isActive = :isActive', {
          isActive: isActive === 'true',
        });
      }

      // Center filter
      if (centerId) {
        queryBuilder.andWhere('center.id = :centerId', { centerId });
      }

      // Batch filter
      if (batchId) {
        queryBuilder.andWhere('batch.id = :batchId', { batchId });
      }

      const [students, total] = await queryBuilder.getManyAndCount();

      res.json({
        status: 'success',
        data: {
          students,
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
        message: error.message || 'Failed to fetch students',
      });
    }
  }

  // Get student by ID
  async getStudentById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const student = await this.studentRepository.findOne({
        where: { id },
        relations: [
          'user',
          'user.center',
          'enrollments',
          'enrollments.program',
          'enrollments.batch',
          'attendances',
          'payments',
          'submissions',
          'submissions.assignment',
          'results',
        ],
      });

      if (!student) {
        return res.status(404).json({
          status: 'error',
          message: 'Student not found',
        });
      }

      res.json({
        status: 'success',
        data: { student },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch student',
      });
    }
  }

  // Get currently logged in student's own profile
  async getMyProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const student = await this.studentRepository.findOne({
        where: { user: { id: userId } },
        relations: ['user'],
      });

      if (!student) {
        return res.status(404).json({
          status: 'error',
          message: 'Student record not found',
        });
      }

      return res.json({
        status: 'success',
        data: { student },
      });
    } catch (error: any) {
      return res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch student profile',
      });
    }
  }

  // Get currently logged in student's enrolled courses
  async getMyCourses(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const { semester } = req.query;

      // Find student associated with the user
      const student = await this.studentRepository.findOne({
        where: { user: { id: userId } },
      });

      if (!student) {
        return res.status(404).json({
          status: 'error',
          message: 'Student record not found',
        });
      }

      // Get programs the student is enrolled in
      const enrollments = await this.enrollmentRepository.find({
        where: { student: { id: student.id }, status: 'ACTIVE' as any },
        relations: ['program', 'program.modules', 'program.modules.lecturer', 'program.modules.lecturer.user'],
      });

      const modules: any[] = [];
      enrollments.forEach(enrollment => {
        if (enrollment.program && enrollment.program.modules) {
          enrollment.program.modules.forEach(module => {
            // Filter by semester if provided
            if (semester && module.semesterNumber !== Number(semester)) {
              return;
            }

            modules.push({
              id: module.id,
              moduleCode: module.moduleCode,
              moduleName: module.moduleName,
              semesterNumber: module.semesterNumber,
              credits: module.credits,
              description: module.description,
              program: enrollment.program ? {
                id: enrollment.program.id,
                programName: enrollment.program.programName
              } : null,
              lecturer: module.lecturer ? {
                id: module.lecturer.id,
                name: `${module.lecturer.user.firstName} ${module.lecturer.user.lastName}`,
                email: module.lecturer.user.email
              } : null
            });
          });
        }
      });

      res.json({
        status: 'success',
        data: { courses: modules },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch student courses',
      });
    }
  }

  // Get currently logged in student's schedule
  async getMySchedule(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const { startDate, endDate } = req.query;

      // Find student associated with the user
      const student = await this.studentRepository.findOne({
        where: { user: { id: userId } },
      });

      if (!student) {
        return res.status(404).json({
          status: 'error',
          message: 'Student record not found',
        });
      }

      // Get active enrollments and their batches
      const enrollments = await this.enrollmentRepository.find({
        where: { student: { id: student.id }, status: 'ACTIVE' as any },
        relations: ['batch'],
      });

      const batchIds = enrollments.map(e => e.batch?.id).filter(id => !!id);

      if (batchIds.length === 0) {
        return res.json({
          status: 'success',
          data: { schedules: [] },
        });
      }

      // Find schedules for these batches
      const queryBuilder = AppDataSource.getRepository(Schedule)
        .createQueryBuilder('schedule')
        .leftJoinAndSelect('schedule.module', 'module')
        .leftJoinAndSelect('schedule.batch', 'batch')
        .leftJoinAndSelect('schedule.lecturer', 'lecturer')
        .leftJoinAndSelect('lecturer.user', 'lecturerUser')
        .leftJoinAndSelect('schedule.center', 'center')
        .where('schedule.batchId IN (:...batchIds)', { batchIds })
        .orderBy('schedule.date', 'ASC')
        .addOrderBy('schedule.startTime', 'ASC');

      if (startDate) {
        queryBuilder.andWhere('schedule.date >= :startDate', { startDate });
      }

      if (endDate) {
        queryBuilder.andWhere('schedule.date <= :endDate', { endDate });
      }

      const schedules = await queryBuilder.getMany();

      res.json({
        status: 'success',
        data: { schedules },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch student schedule',
      });
    }
  }

  // Create new student
  async createStudent(req: Request, res: Response) {
    try {
      const studentData = req.body;

      // Check if user already exists
      const existingUser = await this.userRepository.findOne({
        where: [
          { email: studentData.email },
          { username: studentData.username },
          { nic: studentData.nic },
          { mobileNumber: studentData.mobileNumber }
        ],
      });

      if (existingUser) {
        let message = 'User already exists';
        if (existingUser.email === studentData.email) message = 'Email already registered';
        else if (existingUser.username === studentData.username) message = 'Username already taken';
        else if (existingUser.nic === studentData.nic) message = 'NIC already registered';
        else if (existingUser.mobileNumber === studentData.mobileNumber) message = 'Mobile number already registered';

        return res.status(400).json({
          status: 'error',
          message
        });
      }

      // Generate registration number
      const registrationNumber = await this.generateRegistrationNumber();
      const universityNumber = await this.generateUniversityNumber();

      // Create user first
      const user = this.userRepository.create({
        username: studentData.username,
        email: studentData.email,
        password: studentData.password || 'Student123', // Default password
        firstName: studentData.firstName,
        lastName: studentData.lastName,
        role: 'STUDENT' as any,
        registrationNumber,
        title: studentData.title || 'Mr',
        nameWithInitials: this.generateNameWithInitials(
          studentData.firstName,
          studentData.lastName
        ),
        gender: studentData.gender || ('OTHER' as any),
        dateOfBirth: studentData.dateOfBirth || new Date('2000-01-01'),
        nic: studentData.nic || 'PENDING',
        mobileNumber: studentData.mobileNumber || '0000000000',
        homeNumber: studentData.homeNumber,
        address: studentData.address || 'Not provided',
        profilePic: studentData.profilePic,
        center: studentData.centerId ? { id: studentData.centerId } : undefined,
      });

      const savedUser = await this.userRepository.save(user);

      // Send account creation email
      try {
        await emailService.sendAccountCreationEmail(
          savedUser.email,
          savedUser.firstName,
          savedUser.username,
          studentData.password || 'Student123'
        );
      } catch (emailError) {
        console.error('Failed to send account creation email for student:', emailError);
      }

      // Create student record
      const student = this.studentRepository.create({
        universityNumber,
        paymentType: studentData.paymentType || ('FULL' as any),
      });

      // Set the user relation using the saved user
      student.user = savedUser;

      const savedStudent = await this.studentRepository.save(student);

      // Create initial enrollment if program and batch are provided
      if (studentData.programId && studentData.batchId) {
        const enrollment = this.enrollmentRepository.create({
          student: savedStudent,
          program: { id: studentData.programId },
          batch: { id: studentData.batchId },
          enrollmentDate: new Date(),
          status: 'ACTIVE' as any,
        });
        await this.enrollmentRepository.save(enrollment);
      }

      // Fetch complete student data with relations
      const completeStudent = await this.studentRepository.findOne({
        where: { id: savedStudent.id },
        relations: ['user', 'user.center', 'enrollments', 'enrollments.program', 'enrollments.batch'],
      });

      res.status(201).json({
        status: 'success',
        message: 'Student created successfully',
        data: { student: completeStudent },
      });
    } catch (error: any) {
      let message = error.message || 'Failed to create student';
      
      // Handle TypeORM unique constraint errors
      if (error.code === '23505') {
        const detail = error.detail || '';
        if (detail.includes('email')) message = 'Email already registered';
        else if (detail.includes('username')) message = 'Username already taken';
        else if (detail.includes('nic')) message = 'NIC already registered';
        else if (detail.includes('mobileNumber')) message = 'Mobile number already registered';
        else if (detail.includes('registrationNumber')) message = 'Registration number already exists';
        else if (detail.includes('universityNumber')) message = 'University number already exists';
        else message = 'Resource already exists';
      }

      res.status(400).json({
        status: 'error',
        message,
      });
    }
  }

  // Helper function to generate name with initials
  private generateNameWithInitials(firstName: string, lastName: string): string {
    const initials = firstName
      .split(' ')
      .map(name => name.charAt(0).toUpperCase())
      .join('.');
    return `${initials}. ${lastName}`;
  }

  // Update student
  async updateStudent(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const student = await this.studentRepository.findOne({
        where: { id },
        relations: ['user'],
      });

      if (!student) {
        return res.status(404).json({
          status: 'error',
          message: 'Student not found',
        });
      }

      // Apply user field updates onto the loaded entity
      if (updateData.user) {
        Object.assign(student.user, updateData.user);
      }

      // Resolve center relation
      if (updateData.user?.center) {
        const centerId = updateData.user.center.id;
        student.user.center = centerId ? ({ id: centerId } as any) : null;
      } else if (updateData.centerId !== undefined) {
        student.user.center = updateData.centerId ? ({ id: updateData.centerId } as any) : null;
      }

      // Always reactivate — save the actual entity instance so TypeORM issues an UPDATE
      student.user.isActive = true;
      await this.userRepository.save(student.user);

      // Update student data
      if (updateData.paymentType) {
        student.paymentType = updateData.paymentType;
      }

      await this.studentRepository.save(student);

      // Update enrollment batch/program if provided
      if (updateData.batchId || updateData.programId) {
        const enrollment = await this.enrollmentRepository.findOne({
          where: { student: { id: student.id } },
          order: { createdAt: 'DESC' },
        });

        if (enrollment) {
          if (updateData.batchId) {
            const batch = await this.batchRepository.findOne({ where: { id: updateData.batchId } });
            if (batch) enrollment.batch = batch;
          }
          if (updateData.programId) {
            const program = await this.programRepository.findOne({ where: { id: updateData.programId } });
            if (program) enrollment.program = program;
          }
          await this.enrollmentRepository.save(enrollment);
        }
      }

      res.json({
        status: 'success',
        message: 'Student updated successfully',
        data: { student },
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to update student',
      });
    }
  }

  // Delete student
  async deleteStudent(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const requesterRole = (req as any).user?.role;

      const student = await this.studentRepository.findOne({
        where: { id },
        relations: ['user'],
      });

      if (!student) {
        return res.status(404).json({
          status: 'error',
          message: 'Student not found',
        });
      }

      if (requesterRole === 'ADMIN') {
        // Hard delete — remove all related records then student and user
        const sId = student.id;
        const uId = student.user.id;

        await AppDataSource.transaction(async (manager) => {
          const del = (entity: any, where: string, params: any[]) =>
            manager.query(`DELETE FROM ${entity} WHERE ${where}`, params);

          // quiz_violations & quiz_answers reference quiz_attempts — delete first
          await del('quiz_violations',        '"attemptId" IN (SELECT id FROM quiz_attempts WHERE "studentId" = $1)', [sId]);
          await del('quiz_answers',           '"attemptId" IN (SELECT id FROM quiz_attempts WHERE "studentId" = $1)', [sId]);
          await del('quiz_attempts',          '"studentId" = $1', [sId]);

          // All other student-level records
          await del('prediction',              '"studentId" = $1', [sId]);
          await del('repeat_exam_enrollments', '"studentId" = $1', [sId]);
          await del('result',                  '"studentId" = $1', [sId]);
          await del('submissions',             '"studentId" = $1', [sId]);
          await del('payments',                'student_id = $1', [sId]);
          await del('attendance',              '"studentId" = $1', [sId]);
          await del('feedback',                '"studentId" = $1', [sId]);
          await del('web_authn_credential',    '"studentId" = $1', [sId]);
          await del('enrollment',              '"studentId" = $1', [sId]);

          // Delete the student row
          await del('student', 'id = $1', [sId]);

          // User-level records
          await del('meeting_participants', '"userId" = $1',     [uId]);
          await del('borrowing',            '"borrowerId" = $1', [uId]);
          await del('notification',         '"userId" = $1',     [uId]);

          // Finally delete the user
          await del('"user"', 'id = $1', [uId]);
        });

        return res.json({
          status: 'success',
          message: 'Student permanently deleted',
        });
      } else {
        // Soft delete — deactivate (USER / staff role)
        student.user.isActive = false;
        await this.userRepository.save(student.user);

        return res.json({
          status: 'success',
          message: 'Student deactivated successfully',
        });
      }
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to delete student',
      });
    }
  }

  // Get student statistics
  async getStudentStats(req: Request, res: Response) {
    try {
      const totalStudents = await this.studentRepository.count();
      const activeStudents = await this.studentRepository
        .createQueryBuilder('student')
        .leftJoin('student.user', 'user')
        .where('user.isActive = :isActive', { isActive: true })
        .getCount();

      const fullPaymentStudents = await this.studentRepository.count({
        where: { paymentType: 'FULL' as any },
      });

      const installmentStudents = await this.studentRepository.count({
        where: { paymentType: 'INSTALLMENT' as any },
      });

      res.json({
        status: 'success',
        data: {
          totalStudents,
          activeStudents,
          inactiveStudents: totalStudents - activeStudents,
          fullPaymentStudents,
          installmentStudents,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch statistics',
      });
    }
  }

  // Helper functions
  private async generateRegistrationNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `REG${year}`;
    
    const lastUser = await this.userRepository
      .createQueryBuilder('user')
      .where('user.registrationNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('user.registrationNumber', 'DESC')
      .getOne();

    let nextNumber = 1;
    if (lastUser && lastUser.registrationNumber) {
      const lastNumberStr = lastUser.registrationNumber.substring(prefix.length);
      const lastNumber = parseInt(lastNumberStr, 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    const number = String(nextNumber).padStart(4, '0');
    return `${prefix}${number}`;
  }

  private async generateUniversityNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `UNI${year}`;
    
    const lastStudent = await this.studentRepository
      .createQueryBuilder('student')
      .where('student.universityNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('student.universityNumber', 'DESC')
      .getOne();

    let nextNumber = 1;
    if (lastStudent && lastStudent.universityNumber) {
      const lastNumberStr = lastStudent.universityNumber.substring(prefix.length);
      const lastNumber = parseInt(lastNumberStr, 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    const number = String(nextNumber).padStart(5, '0');
    return `${prefix}${number}`;
  }
  // Get students dropdown (for forms)
  async getStudentsDropdown(req: Request, res: Response) {
    try {
      const students = await this.studentRepository
        .createQueryBuilder('student')
        .leftJoinAndSelect('student.user', 'user')
        .where('user.isActive = :isActive', { isActive: true })
        .select([
          'student.id',
          'student.universityNumber',
          'user.firstName',
          'user.lastName',
        ])
        .orderBy('user.firstName', 'ASC')
        .getMany();

      res.json({
        status: 'success',
        data: { students },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch students',
      });
    }
  }

  // ==================== WebAuthn Registration ====================

  // Start WebAuthn fingerprint registration
  async webauthnRegisterStart(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const student = await this.studentRepository.findOne({
        where: { user: { id: userId } },
        relations: ['user', 'webauthnCredentials'],
      });

      if (!student) {
        return res.status(404).json({ status: 'error', message: 'Student record not found' });
      }

      // Get existing credentials to exclude
      const existingCredentials = student.webauthnCredentials || [];

      const options = await generateRegistrationOptions({
        rpName: env.WEBAUTHN_RP_NAME,
        rpID: env.WEBAUTHN_RP_ID,
        userName: student.user.email,
        userDisplayName: `${student.user.firstName} ${student.user.lastName}`,
        attestationType: 'none',
        excludeCredentials: existingCredentials.map(cred => ({
          id: cred.credentialId,
          transports: (cred.transports || []) as AuthenticatorTransportFuture[],
        })),
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
      });

      // Store challenge with 120-second TTL
      registrationChallenges.set(userId, {
        challenge: options.challenge,
        expiresAt: Date.now() + 120000,
      });

      return res.json({ status: 'success', data: { options } });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message || 'Failed to start registration' });
    }
  }

  // Finish WebAuthn fingerprint registration
  async webauthnRegisterFinish(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const { registrationResponse, deviceName } = req.body;

      if (!registrationResponse) {
        return res.status(400).json({ status: 'error', message: 'registrationResponse is required' });
      }

      const student = await this.studentRepository.findOne({
        where: { user: { id: userId } },
      });

      if (!student) {
        return res.status(404).json({ status: 'error', message: 'Student record not found' });
      }

      // Retrieve stored challenge
      const stored = registrationChallenges.get(userId);
      if (!stored || Date.now() > stored.expiresAt) {
        registrationChallenges.delete(userId);
        return res.status(400).json({ status: 'error', message: 'Registration challenge expired. Please try again.' });
      }
      registrationChallenges.delete(userId);

      const verification = await verifyRegistrationResponse({
        response: registrationResponse,
        expectedChallenge: stored.challenge,
        expectedOrigin: env.WEBAUTHN_ORIGIN,
        expectedRPID: env.WEBAUTHN_RP_ID,
      });

      if (!verification.verified || !verification.registrationInfo) {
        return res.status(400).json({ status: 'error', message: 'Registration verification failed' });
      }

      const { credential, credentialBackedUp, credentialDeviceType } = verification.registrationInfo;

      // Save credential to database
      const webauthnCredential = this.credentialRepository.create({
        credentialId: credential.id,
        credentialPublicKey: Buffer.from(credential.publicKey).toString('base64url'),
        counter: credential.counter,
        credentialBackedUp: credentialBackedUp,
        credentialDeviceType: credentialDeviceType,
        transports: credential.transports as string[] || [],
        deviceName: deviceName || 'My Device',
        student: student,
      });

      await this.credentialRepository.save(webauthnCredential);

      return res.json({
        status: 'success',
        message: 'Fingerprint registered successfully',
        data: {
          credential: {
            id: webauthnCredential.id,
            deviceName: webauthnCredential.deviceName,
            createdAt: webauthnCredential.createdAt,
          },
        },
      });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message || 'Failed to complete registration' });
    }
  }

  // Get registered WebAuthn credentials for logged-in student
  async getWebauthnCredentials(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const student = await this.studentRepository.findOne({
        where: { user: { id: userId } },
      });

      if (!student) {
        return res.status(404).json({ status: 'error', message: 'Student record not found' });
      }

      const credentials = await this.credentialRepository.find({
        where: { student: { id: student.id } },
        select: ['id', 'deviceName', 'credentialDeviceType', 'createdAt'],
        order: { createdAt: 'DESC' },
      });

      return res.json({ status: 'success', data: { credentials } });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message || 'Failed to fetch credentials' });
    }
  }

  // Delete a WebAuthn credential
  async deleteWebauthnCredential(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const { credentialId } = req.params;

      const student = await this.studentRepository.findOne({
        where: { user: { id: userId } },
      });

      if (!student) {
        return res.status(404).json({ status: 'error', message: 'Student record not found' });
      }

      const credential = await this.credentialRepository.findOne({
        where: { id: credentialId, student: { id: student.id } },
      });

      if (!credential) {
        return res.status(404).json({ status: 'error', message: 'Credential not found' });
      }

      await this.credentialRepository.remove(credential);

      return res.json({ status: 'success', message: 'Credential deleted successfully' });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message || 'Failed to delete credential' });
    }
  }

  // ==================== Passkey Management ====================

  // Get my passkey (student)
  async getMyPasskey(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const student = await this.studentRepository.findOne({
        where: { user: { id: userId } },
        select: ['id', 'passkey', 'passkeyRegeneratedAt'],
      });

      if (!student) {
        return res.status(404).json({ status: 'error', message: 'Student record not found' });
      }

      return res.json({
        status: 'success',
        data: {
          passkey: student.passkey,
          regeneratedAt: student.passkeyRegeneratedAt,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message || 'Failed to fetch passkey' });
    }
  }

  // Generate passkey for logged-in student
  async generateMyPasskey(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const student = await this.studentRepository.findOne({
        where: { user: { id: userId } },
      });

      if (!student) {
        return res.status(404).json({ status: 'error', message: 'Student record not found' });
      }

      const passkey = await attendanceService.generateUniquePasskey();
      student.passkey = passkey;
      student.passkeyRegeneratedAt = new Date();
      student.passkeyRegeneratedBy = 'self';
      await this.studentRepository.save(student);

      return res.json({
        status: 'success',
        message: 'Passkey generated successfully',
        data: { passkey },
      });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message || 'Failed to generate passkey' });
    }
  }

  // Admin: Regenerate passkey for a student
  async regenerateStudentPasskey(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const adminUserId = (req as any).user.userId;

      const student = await this.studentRepository.findOne({
        where: { id },
      });

      if (!student) {
        return res.status(404).json({ status: 'error', message: 'Student not found' });
      }

      // Get admin name for audit trail
      const adminUser = await this.userRepository.findOne({
        where: { id: adminUserId },
        select: ['firstName', 'lastName'],
      });
      const adminName = adminUser ? `${adminUser.firstName} ${adminUser.lastName}` : 'Unknown Admin';

      const passkey = await attendanceService.generateUniquePasskey();
      student.passkey = passkey;
      student.passkeyRegeneratedAt = new Date();
      student.passkeyRegeneratedBy = adminName;
      await this.studentRepository.save(student);

      return res.json({
        status: 'success',
        message: 'Passkey regenerated successfully',
        data: { passkey },
      });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message || 'Failed to regenerate passkey' });
    }
  }

  // Admin: Get students with fingerprint/passkey status
  async getStudentsWithFingerprintStatus(req: Request, res: Response) {
    try {
      const { page = 1, limit = 10, search = '', status: filterStatus } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const queryBuilder = this.studentRepository
        .createQueryBuilder('student')
        .leftJoinAndSelect('student.user', 'user')
        .leftJoin('student.webauthnCredentials', 'credentials')
        .addSelect('COUNT(credentials.id)', 'credentialCount')
        .groupBy('student.id')
        .addGroupBy('user.id')
        .skip(skip)
        .take(Number(limit));

      if (search) {
        queryBuilder.where(
          '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR student.universityNumber ILIKE :search)',
          { search: `%${search}%` }
        );
      }

      const students = await queryBuilder.getRawAndEntities();

      const result = students.entities.map((student, index) => {
        const raw = students.raw[index];
        return {
          id: student.id,
          universityNumber: student.universityNumber,
          name: `${student.user.firstName} ${student.user.lastName}`,
          email: student.user.email,
          passkey: student.passkey,
          passkeyRegeneratedAt: student.passkeyRegeneratedAt,
          passkeyRegeneratedBy: student.passkeyRegeneratedBy,
          fingerprintId: student.fingerprintId,
          credentialCount: parseInt(raw.credentialCount || '0', 10),
          status: (student.passkey || student.fingerprintId || parseInt(raw.credentialCount || '0', 10) > 0)
            ? 'Registered' : 'Unregistered',
        };
      });

      // Filter by status if provided
      let filtered = result;
      if (filterStatus === 'Registered') {
        filtered = result.filter(s => s.status === 'Registered');
      } else if (filterStatus === 'Unregistered') {
        filtered = result.filter(s => s.status === 'Unregistered');
      }

      return res.json({
        status: 'success',
        data: {
          students: filtered,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: filtered.length,
          },
        },
      });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message || 'Failed to fetch fingerprint status' });
    }
  }
  // ==================== Export ====================

  async exportStudents(req: Request, res: Response) {
    try {
      const { centerId, batchId, paymentType, isActive } = req.query;

      const queryBuilder = this.studentRepository
        .createQueryBuilder('student')
        .leftJoinAndSelect('student.user', 'user')
        .leftJoinAndSelect('user.center', 'center')
        .leftJoinAndSelect('student.enrollments', 'enrollments')
        .leftJoinAndSelect('enrollments.program', 'program')
        .leftJoinAndSelect('enrollments.batch', 'batch')
        .orderBy('user.firstName', 'ASC');

      if (centerId)    queryBuilder.andWhere('center.id = :centerId', { centerId });
      if (paymentType) queryBuilder.andWhere('student.paymentType = :paymentType', { paymentType });
      if (isActive !== undefined && isActive !== '')
        queryBuilder.andWhere('user.isActive = :isActive', { isActive: isActive === 'true' });
      if (batchId)
        queryBuilder.andWhere('batch.id = :batchId', { batchId });

      const students = await queryBuilder.getMany();

      const rows = students.map(s => {
        const enrollment = s.enrollments?.[0];
        return {
          'Registration Number': s.user.registrationNumber,
          'University Number':   s.universityNumber,
          'Title':               s.user.title,
          'First Name':          s.user.firstName,
          'Last Name':           s.user.lastName,
          'Name With Initials':  s.user.nameWithInitials,
          'Gender':              s.user.gender,
          'Date of Birth':       s.user.dateOfBirth ? new Date(s.user.dateOfBirth).toISOString().split('T')[0] : '',
          'NIC':                 s.user.nic,
          'Email':               s.user.email,
          'Username':            s.user.username,
          'Mobile Number':       s.user.mobileNumber,
          'Home Number':         s.user.homeNumber || '',
          'Address':             s.user.address || '',
          'Payment Type':        s.paymentType,
          'Center':              s.user.center?.centerName || '',
          'Program':             enrollment?.program?.programName || '',
          'Batch':               enrollment?.batch?.batchNumber || '',
          'Status':              s.user.isActive ? 'Active' : 'Inactive',
          'Registered At':       s.user.createdAt ? new Date(s.user.createdAt).toISOString().split('T')[0] : '',
        };
      });

      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.json_to_sheet(rows);

      // Set column widths
      ws['!cols'] = [
        { wch: 18 }, { wch: 16 }, { wch: 8 }, { wch: 16 }, { wch: 16 },
        { wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 28 },
        { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 14 },
        { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 10 }, { wch: 14 },
      ];

      xlsx.utils.book_append_sheet(wb, ws, 'Students');

      const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const filename = `students_${new Date().toISOString().split('T')[0]}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to export students' });
    }
  }

  // ==================== Import ====================

  async importStudents(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ status: 'error', message: 'No file uploaded' });
      }

      const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = xlsx.utils.sheet_to_json(ws, { defval: '' });

      if (rows.length === 0) {
        return res.status(400).json({ status: 'error', message: 'Excel file contains no data rows' });
      }

      const summary = {
        total:    rows.length,
        imported: 0,
        updated:  0,
        skipped:  0,
        errors:   [] as { row: number; name: string; reason: string }[],
      };

      for (let i = 0; i < rows.length; i++) {
        const row    = rows[i];
        const rowNum = i + 2; // Excel row (header = 1, data starts at 2)
        const displayName = `${row['First Name'] || ''} ${row['Last Name'] || ''}`.trim() || `Row ${rowNum}`;

        try {
          // ── Validate required fields ───────────────────────────────────────
          const required: Record<string, string> = {
            'First Name':    'First Name',
            'Last Name':     'Last Name',
            'Email':         'Email',
            'Username':      'Username',
            'NIC':           'NIC',
            'Mobile Number': 'Mobile Number',
            'Date of Birth': 'Date of Birth',
          };
          for (const [col, label] of Object.entries(required)) {
            if (!String(row[col] ?? '').trim()) {
              throw new Error(`Missing required field: ${label}`);
            }
          }

          const email        = String(row['Email']).trim().toLowerCase();
          const username     = String(row['Username']).trim();
          const nic          = String(row['NIC']).trim();
          const mobileNumber = String(row['Mobile Number']).trim();
          const firstName    = String(row['First Name']).trim();
          const lastName     = String(row['Last Name']).trim();

          // ── Resolve optional relations ─────────────────────────────────────
          let centerId:  string | undefined;
          let programId: string | undefined;
          let batchId:   string | undefined;

          if (row['Center']) {
            const center = await this.centerRepository.findOne({ where: { centerName: String(row['Center']).trim() } });
            if (center) centerId = center.id;
          }
          if (row['Program']) {
            const program = await this.programRepository.findOne({ where: { programName: String(row['Program']).trim() } });
            if (program) programId = program.id;
          }
          if (row['Batch']) {
            const batch = await this.batchRepository.findOne({ where: { batchNumber: String(row['Batch']).trim() } });
            if (batch) batchId = batch.id;
          }

          // ── Parse date of birth (handle Excel serial numbers) ─────────────
          let dateOfBirth: Date;
          const dobRaw = row['Date of Birth'];
          if (typeof dobRaw === 'number') {
            dateOfBirth = new Date(Math.round((dobRaw - 25569) * 86400 * 1000));
          } else {
            dateOfBirth = new Date(String(dobRaw));
          }
          if (isNaN(dateOfBirth.getTime())) dateOfBirth = new Date('2000-01-01');

          // ── Check if student already exists (match by email) ───────────────
          const existingUser = await this.userRepository.findOne({
            where: { email },
            relations: ['student'],
          });

          if (existingUser) {
            // ── UPDATE existing student ──────────────────────────────────────
            existingUser.firstName       = firstName;
            existingUser.lastName        = lastName;
            existingUser.username        = username;
            existingUser.nic             = nic;
            existingUser.mobileNumber    = mobileNumber;
            existingUser.title           = row['Title'] || existingUser.title || 'Mr';
            existingUser.nameWithInitials = this.generateNameWithInitials(firstName, lastName);
            existingUser.gender          = row['Gender'] || existingUser.gender;
            existingUser.dateOfBirth     = dateOfBirth;
            existingUser.homeNumber      = row['Home Number'] ? String(row['Home Number']) : existingUser.homeNumber;
            existingUser.address         = row['Address'] || existingUser.address;
            if (centerId) existingUser.center = { id: centerId } as any;

            await this.userRepository.save(existingUser);

            if (existingUser.student) {
              if (row['Payment Type']) {
                existingUser.student.paymentType = (row['Payment Type'] === 'INSTALLMENT' ? 'INSTALLMENT' : 'FULL') as any;
              }
              await this.studentRepository.save(existingUser.student);
            }

            summary.updated++;
          } else {
            // ── CREATE new student ───────────────────────────────────────────
            const registrationNumber = await this.generateRegistrationNumber();
            const universityNumber   = await this.generateUniversityNumber();

            const user = this.userRepository.create({
              username,
              email,
              password:         'Student123',
              firstName,
              lastName,
              role:             'STUDENT' as any,
              registrationNumber,
              title:            row['Title'] || 'Mr',
              nameWithInitials: this.generateNameWithInitials(firstName, lastName),
              gender:           row['Gender'] || ('OTHER' as any),
              dateOfBirth,
              nic,
              mobileNumber,
              homeNumber:       row['Home Number'] ? String(row['Home Number']) : undefined,
              address:          row['Address'] || 'Not provided',
              center:           centerId ? ({ id: centerId } as any) : undefined,
            });

            const savedUser = await this.userRepository.save(user);

            try {
              await emailService.sendAccountCreationEmail(savedUser.email, savedUser.firstName, savedUser.username, 'Student123');
            } catch { /* non-fatal */ }

            const student = this.studentRepository.create({
              universityNumber,
              paymentType: (row['Payment Type'] === 'INSTALLMENT' ? 'INSTALLMENT' : 'FULL') as any,
            });
            student.user = savedUser;
            const savedStudent = await this.studentRepository.save(student);

            if (programId && batchId) {
              const enrollment = this.enrollmentRepository.create({
                student:        savedStudent,
                program:        { id: programId } as any,
                batch:          { id: batchId }   as any,
                enrollmentDate: new Date(),
                status:         'ACTIVE' as any,
              });
              await this.enrollmentRepository.save(enrollment);
            }

            summary.imported++;
          }
        } catch (err: any) {
          summary.skipped++;
          summary.errors.push({ row: rowNum, name: displayName, reason: err.message || 'Unknown error' });
        }
      }

      res.status(200).json({
        status:  'success',
        message: `Processed ${summary.total} students: ${summary.imported} created, ${summary.updated} updated`,
        data:    summary,
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to import students' });
    }
  }
}

export default new StudentController();
