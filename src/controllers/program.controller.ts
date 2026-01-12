import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Program } from '../entities/Program.entity';
import { Module } from '../entities/Module.entity';
import { Enrollment } from '../entities/Enrollment.entity';
import { Center } from '../entities/Center.entity';
import { In } from 'typeorm';

export class ProgramController {
  private programRepository = AppDataSource.getRepository(Program);
  private moduleRepository = AppDataSource.getRepository(Module);
  private enrollmentRepository = AppDataSource.getRepository(Enrollment);
  private centerRepository = AppDataSource.getRepository(Center);

  // Get all programs with pagination and filters
  async getAllPrograms(req: Request, res: Response) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        sortBy = 'createdAt',
        sortOrder = 'DESC',
        centerId = '',
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      const queryBuilder = this.programRepository
        .createQueryBuilder('program')
        .leftJoinAndSelect('program.modules', 'modules')
        .leftJoinAndSelect('program.batches', 'batches')
        .leftJoinAndSelect('program.enrollments', 'enrollments')
        .leftJoinAndSelect('program.centers', 'centers')
        .skip(skip)
        .take(Number(limit))
        .orderBy(`program.${sortBy}`, sortOrder as 'ASC' | 'DESC');

      // Search filter
      if (search) {
        queryBuilder.andWhere(
          '(program.programName ILIKE :search OR program.programCode ILIKE :search OR program.description ILIKE :search)',
          { search: `%${search}%` }
        );
      }

      // Center filter
      if (centerId) {
        queryBuilder.andWhere('centers.id = :centerId', { centerId });
      }

      const [programs, total] = await queryBuilder.getManyAndCount();

      // Add statistics for each program
      const programsWithStats = await Promise.all(
        programs.map(async program => {
          const moduleCount = await this.moduleRepository.count({
            where: { program: { id: program.id } },
          });

          const enrollmentCount = await this.enrollmentRepository.count({
            where: { program: { id: program.id } },
          });

          return {
            ...program,
            stats: {
              moduleCount,
              enrollmentCount,
            },
          };
        })
      );

      res.json({
        status: 'success',
        data: {
          programs: programsWithStats,
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
        message: error.message || 'Failed to fetch programs',
      });
    }
  }

  // Get program by ID
  async getProgramById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const program = await this.programRepository.findOne({
        where: { id },
        relations: [
          'modules',
          'modules.lecturer',
          'modules.lecturer.user',
          'batches',
          'enrollments',
          'enrollments.student',
          'enrollments.student.user',
          'centers',
        ],
      });

      if (!program) {
        return res.status(404).json({
          status: 'error',
          message: 'Program not found',
        });
      }

      // Get statistics
      const moduleCount = program.modules.length;
      const enrollmentCount = program.enrollments.length;
      const activeEnrollments = program.enrollments.filter(e => e.status === 'ACTIVE').length;

      res.json({
        status: 'success',
        data: {
          program: {
            ...program,
            stats: {
              moduleCount,
              enrollmentCount,
              activeEnrollments,
            },
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch program',
      });
    }
  }

  // Create new program
  async createProgram(req: Request, res: Response) {
    try {
      const { programCode, programName, duration, programFee, description, centerIds } = req.body;

      // Check if program code already exists
      const existingProgram = await this.programRepository.findOne({
        where: { programCode },
      });

      if (existingProgram) {
        return res.status(400).json({
          status: 'error',
          message: 'Program code already exists',
        });
      }

      // Fetch centers if centerIds provided
      let centers: Center[] = [];
      if (centerIds && Array.isArray(centerIds) && centerIds.length > 0) {
        centers = await this.centerRepository.find({
          where: { id: In(centerIds) }
        });
      }

      // Create program
      const program = this.programRepository.create({
        programCode,
        programName,
        duration,
        programFee,
        description,
        centers,
      });

      await this.programRepository.save(program);

      res.status(201).json({
        status: 'success',
        message: 'Program created successfully',
        data: { program },
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to create program',
      });
    }
  }

  // Update program
  async updateProgram(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { programCode, programName, duration, programFee, description, centerIds } = req.body;

      const program = await this.programRepository.findOne({
        where: { id },
        relations: ['centers'],
      });

      if (!program) {
        return res.status(404).json({
          status: 'error',
          message: 'Program not found',
        });
      }

      // Check if new program code conflicts with existing
      if (programCode && programCode !== program.programCode) {
        const existingProgram = await this.programRepository.findOne({
          where: { programCode },
        });

        if (existingProgram) {
          return res.status(400).json({
            status: 'error',
            message: 'Program code already exists',
          });
        }
      }

      // Update fields
      if (programCode) program.programCode = programCode;
      if (programName) program.programName = programName;
      if (duration) program.duration = duration;
      if (programFee !== undefined) program.programFee = programFee;
      if (description !== undefined) program.description = description;

      // Update centers if centerIds provided
      if (centerIds && Array.isArray(centerIds)) {
        const centers = await this.centerRepository.find({
          where: { id: In(centerIds) }
        });
        program.centers = centers;
      }

      await this.programRepository.save(program);

      res.json({
        status: 'success',
        message: 'Program updated successfully',
        data: { program },
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to update program',
      });
    }
  }

  // Delete program
  async deleteProgram(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const program = await this.programRepository.findOne({
        where: { id },
        relations: ['modules', 'enrollments', 'batches'],
      });

      if (!program) {
        return res.status(404).json({
          status: 'error',
          message: 'Program not found',
        });
      }

      // Check if program has active enrollments
      const activeEnrollments = program.enrollments.filter(e => e.status === 'ACTIVE');

      if (activeEnrollments.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: `Cannot delete program with ${activeEnrollments.length} active enrollments`,
        });
      }

      // Delete program (cascade will handle modules and batches)
      await this.programRepository.remove(program);

      res.json({
        status: 'success',
        message: 'Program deleted successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to delete program',
      });
    }
  }

  // Get program statistics
  async getProgramStats(req: Request, res: Response) {
    try {
      const totalPrograms = await this.programRepository.count();

      const programs = await this.programRepository.find({
        relations: ['enrollments', 'modules'],
      });

      let totalEnrollments = 0;
      let totalModules = 0;
      let totalRevenue = 0;

      programs.forEach(program => {
        totalEnrollments += program.enrollments.length;
        totalModules += program.modules.length;
        totalRevenue += program.enrollments.length * Number(program.programFee);
      });

      const avgModulesPerProgram = totalPrograms > 0 ? totalModules / totalPrograms : 0;

      res.json({
        status: 'success',
        data: {
          totalPrograms,
          totalEnrollments,
          totalModules,
          avgModulesPerProgram: Math.round(avgModulesPerProgram * 10) / 10,
          totalRevenue,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch statistics',
      });
    }
  }

  // Get programs dropdown (for forms)
  async getProgramsDropdown(req: Request, res: Response) {
    try {
      const programs = await this.programRepository.find({
        select: ['id', 'programCode', 'programName'],
        order: { programName: 'ASC' },
      });

      res.json({
        status: 'success',
        data: { programs },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch programs',
      });
    }
  }
}

export default new ProgramController();
