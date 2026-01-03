import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Module } from '../entities/Module.entity';
import { Program } from '../entities/Program.entity';
import { Lecturer } from '../entities/Lecturer.entity';

export class ModuleController {
  private moduleRepository = AppDataSource.getRepository(Module);
  private programRepository = AppDataSource.getRepository(Program);
  private lecturerRepository = AppDataSource.getRepository(Lecturer);

  // Get all modules with pagination and filters
  async getAllModules(req: Request, res: Response) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        programId = '',
        lecturerId = '',
        semesterNumber = '',
        sortBy = 'createdAt',
        sortOrder = 'DESC',
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      const queryBuilder = this.moduleRepository
        .createQueryBuilder('module')
        .leftJoinAndSelect('module.program', 'program')
        .leftJoinAndSelect('module.lecturer', 'lecturer')
        .leftJoinAndSelect('lecturer.user', 'lecturerUser')
        .leftJoinAndSelect('module.schedules', 'schedules')
        .leftJoinAndSelect('module.assignments', 'assignments')
        .skip(skip)
        .take(Number(limit))
        .orderBy(`module.${sortBy}`, sortOrder as 'ASC' | 'DESC');

      // Search filter
      if (search) {
        queryBuilder.where(
          '(module.moduleName ILIKE :search OR module.moduleCode ILIKE :search OR module.description ILIKE :search)',
          { search: `%${search}%` }
        );
      }

      // Program filter
      if (programId) {
        queryBuilder.andWhere('module.programId = :programId', { programId });
      }

      // Lecturer filter
      if (lecturerId) {
        queryBuilder.andWhere('module.lecturerId = :lecturerId', { lecturerId });
      }

      // Semester filter
      if (semesterNumber) {
        queryBuilder.andWhere('module.semesterNumber = :semesterNumber', {
          semesterNumber: Number(semesterNumber),
        });
      }

      const [modules, total] = await queryBuilder.getManyAndCount();

      res.json({
        status: 'success',
        data: {
          modules,
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
        message: error.message || 'Failed to fetch modules',
      });
    }
  }

  // Get module by ID
  async getModuleById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const module = await this.moduleRepository.findOne({
        where: { id },
        relations: [
          'program',
          'lecturer',
          'lecturer.user',
          'schedules',
          'schedules.batch',
          'assignments',
          'results',
          'feedbacks',
        ],
      });

      if (!module) {
        return res.status(404).json({
          status: 'error',
          message: 'Module not found',
        });
      }

      res.json({
        status: 'success',
        data: { module },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch module',
      });
    }
  }

  // Create new module
  async createModule(req: Request, res: Response) {
    try {
      const {
        moduleCode,
        moduleName,
        semesterNumber,
        credits,
        description,
        programId,
        lecturerId,
      } = req.body;

      // Check if module code already exists
      const existingModule = await this.moduleRepository.findOne({
        where: { moduleCode },
      });

      if (existingModule) {
        return res.status(400).json({
          status: 'error',
          message: 'Module code already exists',
        });
      }

      // Verify program exists
      const program = await this.programRepository.findOne({
        where: { id: programId },
      });

      if (!program) {
        return res.status(404).json({
          status: 'error',
          message: 'Program not found',
        });
      }

      // Verify lecturer exists if provided
      let lecturer = null;
      if (lecturerId) {
        lecturer = await this.lecturerRepository.findOne({
          where: { id: lecturerId },
        });

        if (!lecturer) {
          return res.status(404).json({
            status: 'error',
            message: 'Lecturer not found',
          });
        }
      }

      // Create module
      const module = this.moduleRepository.create({
        moduleCode,
        moduleName,
        semesterNumber,
        credits,
        description,
      });

      module.program = program;
      if (lecturer) {
        module.lecturer = lecturer;
      }

      await this.moduleRepository.save(module);

      // Fetch complete module with relations
      const completeModule = await this.moduleRepository.findOne({
        where: { id: module.id },
        relations: ['program', 'lecturer', 'lecturer.user'],
      });

      res.status(201).json({
        status: 'success',
        message: 'Module created successfully',
        data: { module: completeModule },
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to create module',
      });
    }
  }

  // Update module
  async updateModule(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const {
        moduleCode,
        moduleName,
        semesterNumber,
        credits,
        description,
        programId,
        lecturerId,
      } = req.body;

      const module = await this.moduleRepository.findOne({
        where: { id },
        relations: ['program', 'lecturer'],
      });

      if (!module) {
        return res.status(404).json({
          status: 'error',
          message: 'Module not found',
        });
      }

      // Check if new module code conflicts with existing
      if (moduleCode && moduleCode !== module.moduleCode) {
        const existingModule = await this.moduleRepository.findOne({
          where: { moduleCode },
        });

        if (existingModule) {
          return res.status(400).json({
            status: 'error',
            message: 'Module code already exists',
          });
        }
      }

      // Update fields
      if (moduleCode) module.moduleCode = moduleCode;
      if (moduleName) module.moduleName = moduleName;
      if (semesterNumber !== undefined) module.semesterNumber = semesterNumber;
      if (credits !== undefined) module.credits = credits;
      if (description !== undefined) module.description = description;

      // Update program if provided
      if (programId) {
        const program = await this.programRepository.findOne({
          where: { id: programId },
        });

        if (!program) {
          return res.status(404).json({
            status: 'error',
            message: 'Program not found',
          });
        }

        module.program = program;
      }

      // Update lecturer if provided
      if (lecturerId) {
        if (lecturerId === 'null' || lecturerId === '') {
          module.lecturer = null as any;
        } else {
          const lecturer = await this.lecturerRepository.findOne({
            where: { id: lecturerId },
          });

          if (!lecturer) {
            return res.status(404).json({
              status: 'error',
              message: 'Lecturer not found',
            });
          }

          module.lecturer = lecturer;
        }
      }

      await this.moduleRepository.save(module);

      // Fetch complete module with relations
      const updatedModule = await this.moduleRepository.findOne({
        where: { id: module.id },
        relations: ['program', 'lecturer', 'lecturer.user'],
      });

      res.json({
        status: 'success',
        message: 'Module updated successfully',
        data: { module: updatedModule },
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to update module',
      });
    }
  }

  // Delete module
  async deleteModule(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const module = await this.moduleRepository.findOne({
        where: { id },
        relations: ['schedules', 'assignments', 'results'],
      });

      if (!module) {
        return res.status(404).json({
          status: 'error',
          message: 'Module not found',
        });
      }

      // Check if module has schedules
      if (module.schedules && module.schedules.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: `Cannot delete module with ${module.schedules.length} existing schedules`,
        });
      }

      // Delete module
      await this.moduleRepository.remove(module);

      res.json({
        status: 'success',
        message: 'Module deleted successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to delete module',
      });
    }
  }

  // Get module statistics
  async getModuleStats(req: Request, res: Response) {
    try {
      const totalModules = await this.moduleRepository.count();

      const modulesWithLecturer = await this.moduleRepository
        .createQueryBuilder('module')
        .where('module.lecturerId IS NOT NULL')
        .getCount();

      const modulesWithoutLecturer = totalModules - modulesWithLecturer;

      // Get modules by semester
      const modulesBySemester = await this.moduleRepository
        .createQueryBuilder('module')
        .select('module.semesterNumber', 'semester')
        .addSelect('COUNT(*)', 'count')
        .groupBy('module.semesterNumber')
        .orderBy('module.semesterNumber', 'ASC')
        .getRawMany();

      res.json({
        status: 'success',
        data: {
          totalModules,
          modulesWithLecturer,
          modulesWithoutLecturer,
          modulesBySemester,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch statistics',
      });
    }
  }

  // Get modules dropdown (for forms)
  async getModulesDropdown(req: Request, res: Response) {
    try {
      const { programId } = req.query;

      const queryBuilder = this.moduleRepository
        .createQueryBuilder('module')
        .select(['module.id', 'module.moduleCode', 'module.moduleName'])
        .orderBy('module.moduleName', 'ASC');

      if (programId) {
        queryBuilder.where('module.programId = :programId', { programId });
      }

      const modules = await queryBuilder.getMany();

      res.json({
        status: 'success',
        data: { modules },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch modules',
      });
    }
  }
}

export default new ModuleController();
