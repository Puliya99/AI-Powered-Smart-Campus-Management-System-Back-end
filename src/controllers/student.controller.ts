import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Student } from '../entities/Student.entity';
import { User } from '../entities/User.entity';
import { Enrollment } from '../entities/Enrollment.entity';

export class StudentController {
  private studentRepository = AppDataSource.getRepository(Student);
  private userRepository = AppDataSource.getRepository(User);

  // Get all students with pagination and filters
  async getAllStudents(req: Request, res: Response) {
    try {
      const { page = 1, limit = 10, search = '', paymentType, isActive } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      const queryBuilder = this.studentRepository
        .createQueryBuilder('student')
        .leftJoinAndSelect('student.user', 'user')
        .leftJoinAndSelect('user.center', 'center')
        .leftJoinAndSelect('student.enrollments', 'enrollments')
        .leftJoinAndSelect('enrollments.program', 'program')
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
        queryBuilder.andWhere('student.paymentType = :paymentType', { paymentType });
      }

      // Active status filter
      if (isActive !== undefined) {
        queryBuilder.andWhere('user.isActive = :isActive', { isActive: isActive === 'true' });
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
        where: [{ email: studentData.email }, { username: studentData.username }],
      });

      if (existingUser) {
        return res.status(400).json({
          status: 'error',
          message: 'Email or username already exists',
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

      // Fetch complete student data with relations
      const completeStudent = await this.studentRepository.findOne({
        where: { id: savedStudent.id },
        relations: ['user', 'user.center'],
      });

      res.status(201).json({
        status: 'success',
        message: 'Student created successfully',
        data: { student: completeStudent },
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to create student',
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
        await this.userRepository.update(student.user.id, updateData.user);
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
    const count = await this.userRepository.count();
    const number = String(count + 1).padStart(4, '0');
    return `REG${year}${number}`;
  }

  private async generateUniversityNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.studentRepository.count();
    const number = String(count + 1).padStart(5, '0');
    return `UNI${year}${number}`;
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
