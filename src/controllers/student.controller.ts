import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Student } from '../entities/Student.entity';
import { User } from '../entities/User.entity';
import { Enrollment } from '../entities/Enrollment.entity';
import { Center } from '../entities/Center.entity';
import { Batch } from '../entities/Batch.entity';
import { Program } from '../entities/Program.entity';
import { Schedule } from '../entities/Schedule.entity';
import { WebAuthnCredential } from '../entities/WebAuthnCredential.entity';
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

      // Update user data
      if (updateData.user) {
        if (updateData.user.center) {
          // If center is passed as an object { id: ... }
          const centerId = updateData.user.center.id;
          updateData.user.center = centerId ? { id: centerId } : null;
        } else if (updateData.centerId !== undefined) {
          // If centerId is passed directly
          updateData.user.center = updateData.centerId ? { id: updateData.centerId } : null;
        }
        await this.userRepository.save({ ...student.user, ...updateData.user });
      }

      // Update student data
      if (updateData.paymentType) {
        student.paymentType = updateData.paymentType;
      }

      await this.studentRepository.save(student);

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

  // Delete/deactivate student
  async deleteStudent(req: Request, res: Response) {
    try {
      const { id } = req.params;

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

      // Soft delete - deactivate user
      student.user.isActive = false;
      await this.userRepository.save(student.user);

      res.json({
        status: 'success',
        message: 'Student deactivated successfully',
      });
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
}

export default new StudentController();
