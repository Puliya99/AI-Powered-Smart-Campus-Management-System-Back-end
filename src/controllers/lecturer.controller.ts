import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Lecturer } from '../entities/Lecturer.entity';
import { User } from '../entities/User.entity';
import { Module } from '../entities/Module.entity';
import { Schedule } from '../entities/Schedule.entity';

export class LecturerController {
  private lecturerRepository = AppDataSource.getRepository(Lecturer);
  private userRepository = AppDataSource.getRepository(User);
  private moduleRepository = AppDataSource.getRepository(Module);
  private scheduleRepository = AppDataSource.getRepository(Schedule);

  // Get all lecturers with pagination and filters
  async getAllLecturers(req: Request, res: Response) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        specialization = '',
        isActive = '',
        sortBy = 'createdAt',
        sortOrder = 'DESC',
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      const queryBuilder = this.lecturerRepository
        .createQueryBuilder('lecturer')
        .leftJoinAndSelect('lecturer.user', 'user')
        .leftJoinAndSelect('user.center', 'center')
        .leftJoinAndSelect('lecturer.modules', 'modules')
        .leftJoinAndSelect('lecturer.schedules', 'schedules')
        .skip(skip)
        .take(Number(limit))
        .orderBy(`lecturer.${sortBy}`, sortOrder as 'ASC' | 'DESC');

      // Search filter
      if (search) {
        queryBuilder.where(
          '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search OR lecturer.specialization ILIKE :search)',
          { search: `%${search}%` }
        );
      }

      // Specialization filter
      if (specialization) {
        queryBuilder.andWhere('lecturer.specialization ILIKE :specialization', {
          specialization: `%${specialization}%`,
        });
      }

      // Active status filter
      if (isActive !== '') {
        queryBuilder.andWhere('user.isActive = :isActive', {
          isActive: isActive === 'true',
        });
      }

      const [lecturers, total] = await queryBuilder.getManyAndCount();

      // Add statistics for each lecturer
      const lecturersWithStats = await Promise.all(
        lecturers.map(async lecturer => {
          const moduleCount = await this.moduleRepository.count({
            where: { lecturer: { id: lecturer.id } },
          });

          const scheduleCount = await this.scheduleRepository.count({
            where: { lecturer: { id: lecturer.id } },
          });

          return {
            ...lecturer,
            stats: {
              moduleCount,
              scheduleCount,
            },
          };
        })
      );

      res.json({
        status: 'success',
        data: {
          lecturers: lecturersWithStats,
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
        message: error.message || 'Failed to fetch lecturers',
      });
    }
  }

  // Get lecturer by ID
  async getLecturerById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const lecturer = await this.lecturerRepository.findOne({
        where: { id },
        relations: [
          'user',
          'user.center',
          'modules',
          'modules.program',
          'schedules',
          'schedules.module',
          'schedules.batch',
          'lectureNotes',
        ],
      });

      if (!lecturer) {
        return res.status(404).json({
          status: 'error',
          message: 'Lecturer not found',
        });
      }

      // Get statistics
      const moduleCount = lecturer.modules.length;
      const scheduleCount = lecturer.schedules.length;
      const lectureNotesCount = lecturer.lectureNotes.length;

      res.json({
        status: 'success',
        data: {
          lecturer: {
            ...lecturer,
            stats: {
              moduleCount,
              scheduleCount,
              lectureNotesCount,
            },
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch lecturer',
      });
    }
  }

  // Create new lecturer
  async createLecturer(req: Request, res: Response) {
    try {
      const lecturerData = req.body;

      // Check if user already exists
      const existingUser = await this.userRepository.findOne({
        where: [
          { email: lecturerData.email },
          { username: lecturerData.username },
          { mobileNumber: lecturerData.mobileNumber },
          { nic: lecturerData.nic },
        ],
      });

      if (existingUser) {
        if (existingUser.email === lecturerData.email) {
          return res.status(400).json({
            status: 'error',
            message: 'Email already registered',
          });
        }
        if (existingUser.username === lecturerData.username) {
          return res.status(400).json({
            status: 'error',
            message: 'Username already taken',
          });
        }
        if (existingUser.mobileNumber === lecturerData.mobileNumber) {
          return res.status(400).json({
            status: 'error',
            message: 'Mobile number already registered',
          });
        }
        if (existingUser.nic === lecturerData.nic) {
          return res.status(400).json({
            status: 'error',
            message: 'NIC already registered',
          });
        }
      }

      // Generate unique registration number
      const registrationNumber = await this.generateRegistrationNumber();

      // Create user first
      const user = this.userRepository.create({
        username: lecturerData.username,
        email: lecturerData.email,
        password: lecturerData.password || 'Lecturer123',
        firstName: lecturerData.firstName,
        lastName: lecturerData.lastName,
        role: 'LECTURER' as any,
        registrationNumber,
        title: lecturerData.title || 'Mr',
        nameWithInitials: this.generateNameWithInitials(
          lecturerData.firstName,
          lecturerData.lastName
        ),
        gender: lecturerData.gender || ('OTHER' as any),
        dateOfBirth: lecturerData.dateOfBirth || new Date('1980-01-01'),
        nic: lecturerData.nic,
        mobileNumber: lecturerData.mobileNumber,
        homeNumber: lecturerData.homeNumber,
        address: lecturerData.address || 'Not provided',
        profilePic: lecturerData.profilePic,
      });

      const savedUser = await this.userRepository.save(user);

      // Create lecturer record
      const lecturer = this.lecturerRepository.create({
        specialization: lecturerData.specialization,
        qualification: lecturerData.qualification,
      });

      lecturer.user = savedUser;

      const savedLecturer = await this.lecturerRepository.save(lecturer);

      // Fetch complete lecturer data with relations
      const completeLecturer = await this.lecturerRepository.findOne({
        where: { id: savedLecturer.id },
        relations: ['user', 'user.center'],
      });

      res.status(201).json({
        status: 'success',
        message: 'Lecturer created successfully',
        data: { lecturer: completeLecturer },
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to create lecturer',
      });
    }
  }

  // Update lecturer
  async updateLecturer(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const lecturer = await this.lecturerRepository.findOne({
        where: { id },
        relations: ['user'],
      });

      if (!lecturer) {
        return res.status(404).json({
          status: 'error',
          message: 'Lecturer not found',
        });
      }

      // Update user data
      if (updateData.user) {
        await this.userRepository.update(lecturer.user.id, updateData.user);
      }

      // Update lecturer data
      if (updateData.specialization !== undefined) {
        lecturer.specialization = updateData.specialization;
      }
      if (updateData.qualification !== undefined) {
        lecturer.qualification = updateData.qualification;
      }

      await this.lecturerRepository.save(lecturer);

      // Fetch updated lecturer with relations
      const updatedLecturer = await this.lecturerRepository.findOne({
        where: { id: lecturer.id },
        relations: ['user', 'user.center'],
      });

      res.json({
        status: 'success',
        message: 'Lecturer updated successfully',
        data: { lecturer: updatedLecturer },
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to update lecturer',
      });
    }
  }

  // Delete/deactivate lecturer
  async deleteLecturer(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const lecturer = await this.lecturerRepository.findOne({
        where: { id },
        relations: ['user', 'modules', 'schedules'],
      });

      if (!lecturer) {
        return res.status(404).json({
          status: 'error',
          message: 'Lecturer not found',
        });
      }

      // Check if lecturer has assigned modules
      if (lecturer.modules && lecturer.modules.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: `Cannot delete lecturer with ${lecturer.modules.length} assigned modules`,
        });
      }

      // Soft delete - deactivate user
      lecturer.user.isActive = false;
      await this.userRepository.save(lecturer.user);

      res.json({
        status: 'success',
        message: 'Lecturer deactivated successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to delete lecturer',
      });
    }
  }

  // Get lecturer statistics
  async getLecturerStats(req: Request, res: Response) {
    try {
      const totalLecturers = await this.lecturerRepository.count();

      const activeLecturers = await this.lecturerRepository
        .createQueryBuilder('lecturer')
        .leftJoin('lecturer.user', 'user')
        .where('user.isActive = :isActive', { isActive: true })
        .getCount();

      const lecturersWithModules = await this.lecturerRepository
        .createQueryBuilder('lecturer')
        .leftJoin('lecturer.modules', 'modules')
        .where('modules.id IS NOT NULL')
        .getCount();

      const lecturersWithoutModules = totalLecturers - lecturersWithModules;

      // Get total modules assigned
      const totalModulesAssigned = await this.moduleRepository
        .createQueryBuilder('module')
        .where('module.lecturerId IS NOT NULL')
        .getCount();

      res.json({
        status: 'success',
        data: {
          totalLecturers,
          activeLecturers,
          inactiveLecturers: totalLecturers - activeLecturers,
          lecturersWithModules,
          lecturersWithoutModules,
          totalModulesAssigned,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch statistics',
      });
    }
  }

  // Get lecturers dropdown (for forms)
  async getLecturersDropdown(req: Request, res: Response) {
    try {
      const lecturers = await this.lecturerRepository.find({
        relations: ['user'],
        order: { createdAt: 'DESC' },
      });

      const lecturersList = lecturers
        .filter(lecturer => lecturer.user.isActive)
        .map(lecturer => ({
          id: lecturer.id,
          name: `${lecturer.user.firstName} ${lecturer.user.lastName}`,
          specialization: lecturer.specialization,
        }));

      res.json({
        status: 'success',
        data: { lecturers: lecturersList },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch lecturers',
      });
    }
  }

  // Helper functions
  private async generateRegistrationNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.userRepository.count();
    const number = String(count + 1).padStart(4, '0');
    return `LEC${year}${number}`;
  }

  private generateNameWithInitials(firstName: string, lastName: string): string {
    const initials = firstName
      .split(' ')
      .map(name => name.charAt(0).toUpperCase())
      .join('.');
    return `${initials}. ${lastName}`;
  }
}

export default new LecturerController();
