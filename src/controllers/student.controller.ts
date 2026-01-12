import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Student } from '../entities/Student.entity';
import { User } from '../entities/User.entity';
import { Enrollment } from '../entities/Enrollment.entity';
import { Center } from '../entities/Center.entity';
import { Batch } from '../entities/Batch.entity';
import { Program } from '../entities/Program.entity';

export class StudentController {
  private studentRepository = AppDataSource.getRepository(Student);
  private userRepository = AppDataSource.getRepository(User);
  private enrollmentRepository = AppDataSource.getRepository(Enrollment);
  private centerRepository = AppDataSource.getRepository(Center);
  private batchRepository = AppDataSource.getRepository(Batch);
  private programRepository = AppDataSource.getRepository(Program);

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
          'assignments',
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
}

export default new StudentController();
