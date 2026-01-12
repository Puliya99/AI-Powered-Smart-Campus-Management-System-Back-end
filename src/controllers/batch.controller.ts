import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Batch } from '../entities/Batch.entity';
import { Program } from '../entities/Program.entity';
import { Enrollment } from '../entities/Enrollment.entity';
import { Schedule } from '../entities/Schedule.entity';
import { Center } from '../entities/Center.entity';
import { BatchStatus } from '../enums/BatchStatus.enum';
import { In } from 'typeorm';

export class BatchController {
  private batchRepository = AppDataSource.getRepository(Batch);
  private programRepository = AppDataSource.getRepository(Program);
  private enrollmentRepository = AppDataSource.getRepository(Enrollment);
  private scheduleRepository = AppDataSource.getRepository(Schedule);
  private centerRepository = AppDataSource.getRepository(Center);

  // Get all batches with pagination and filters
  async getAllBatches(req: Request, res: Response) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        programId = '',
        status = '',
        centerId = '',
        sortBy = 'createdAt',
        sortOrder = 'DESC',
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      const queryBuilder = this.batchRepository
        .createQueryBuilder('batch')
        .leftJoinAndSelect('batch.program', 'program')
        .leftJoinAndSelect('batch.enrollments', 'enrollments')
        .leftJoinAndSelect('batch.schedules', 'schedules')
        .leftJoinAndSelect('batch.centers', 'centers')
        .skip(skip)
        .take(Number(limit))
        .orderBy(`batch.${sortBy}`, sortOrder as 'ASC' | 'DESC');

      // Search filter
      if (search) {
        queryBuilder.where(
          '(batch.batchNumber ILIKE :search OR program.programName ILIKE :search)',
          { search: `%${search}%` }
        );
      }

      // Program filter
      if (programId) {
        queryBuilder.andWhere('batch.programId = :programId', { programId });
      }

      // Status filter
      if (status) {
        queryBuilder.andWhere('batch.status = :status', { status });
      }

      // Center filter
      if (centerId) {
        queryBuilder.andWhere('centers.id = :centerId', { centerId });
      }

      const [batches, total] = await queryBuilder.getManyAndCount();

      // Add statistics for each batch
      const batchesWithStats = await Promise.all(
        batches.map(async batch => {
          const enrollmentCount = await this.enrollmentRepository.count({
            where: { batch: { id: batch.id } },
          });

          const activeEnrollments = await this.enrollmentRepository.count({
            where: { batch: { id: batch.id }, status: 'ACTIVE' as any },
          });

          const scheduleCount = await this.scheduleRepository.count({
            where: { batch: { id: batch.id } },
          });

          return {
            ...batch,
            stats: {
              enrollmentCount,
              activeEnrollments,
              scheduleCount,
            },
          };
        })
      );

      res.json({
        status: 'success',
        data: {
          batches: batchesWithStats,
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
        message: error.message || 'Failed to fetch batches',
      });
    }
  }

  // Get batch by ID
  async getBatchById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const batch = await this.batchRepository.findOne({
        where: { id },
        relations: [
          'program',
          'enrollments',
          'enrollments.student',
          'enrollments.student.user',
          'schedules',
          'schedules.module',
          'schedules.lecturer',
          'schedules.lecturer.user',
          'centers',
        ],
      });

      if (!batch) {
        return res.status(404).json({
          status: 'error',
          message: 'Batch not found',
        });
      }

      // Get statistics
      const enrollmentCount = batch.enrollments.length;
      const activeEnrollments = batch.enrollments.filter(e => e.status === 'ACTIVE').length;
      const scheduleCount = batch.schedules.length;
      const completedSchedules = batch.schedules.filter(s => s.status === 'COMPLETED').length;

      res.json({
        status: 'success',
        data: {
          batch: {
            ...batch,
            stats: {
              enrollmentCount,
              activeEnrollments,
              scheduleCount,
              completedSchedules,
            },
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch batch',
      });
    }
  }

  // Create new batch
  async createBatch(req: Request, res: Response) {
    try {
      const { batchNumber, startDate, endDate, programId, status, centerIds } = req.body;

      // Check if batch number already exists
      const existingBatch = await this.batchRepository.findOne({
        where: { batchNumber },
      });

      if (existingBatch) {
        return res.status(400).json({
          status: 'error',
          message: 'Batch number already exists',
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

      // Validate dates
      const start = new Date(startDate);
      const end = endDate ? new Date(endDate) : null;

      if (end && end <= start) {
        return res.status(400).json({
          status: 'error',
          message: 'End date must be after start date',
        });
      }

      // Fetch centers if centerIds provided
      let centers: Center[] = [];
      if (centerIds && Array.isArray(centerIds) && centerIds.length > 0) {
        centers = await this.centerRepository.find({
          where: { id: In(centerIds) }
        });
      }

      // Create batch
      const batch = this.batchRepository.create({
        batchNumber,
        startDate: start,
        endDate: end || undefined,
        program,
        centers,
        status: status || BatchStatus.UPCOMING,
      });

      batch.program = program;
      // batch.centers = centers; // already set in create()

      await this.batchRepository.save(batch);

      // Fetch complete batch with relations
      const completeBatch = await this.batchRepository.findOne({
        where: { id: batch.id },
        relations: ['program'],
      });

      res.status(201).json({
        status: 'success',
        message: 'Batch created successfully',
        data: { batch: completeBatch },
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to create batch',
      });
    }
  }

  // Update batch
  async updateBatch(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { batchNumber, startDate, endDate, programId, status, centerIds } = req.body;

      const batch = await this.batchRepository.findOne({
        where: { id },
        relations: ['program', 'centers'],
      });

      if (!batch) {
        return res.status(404).json({
          status: 'error',
          message: 'Batch not found',
        });
      }

      // Check if new batch number conflicts with existing
      if (batchNumber && batchNumber !== batch.batchNumber) {
        const existingBatch = await this.batchRepository.findOne({
          where: { batchNumber },
        });

        if (existingBatch) {
          return res.status(400).json({
            status: 'error',
            message: 'Batch number already exists',
          });
        }
      }

      // Update fields
      if (batchNumber) batch.batchNumber = batchNumber;
      if (startDate) batch.startDate = new Date(startDate);
      if (endDate !== undefined) {
        if (endDate) {
          batch.endDate = new Date(endDate);
        }
      }
      if (status) batch.status = status;

      // Validate dates
      if (batch.endDate && batch.endDate <= batch.startDate) {
        return res.status(400).json({
          status: 'error',
          message: 'End date must be after start date',
        });
      }

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

        batch.program = program;
      }

      // Update centers if provided
      if (centerIds && Array.isArray(centerIds)) {
        const centers = await this.centerRepository.find({
          where: { id: In(centerIds) }
        });
        batch.centers = centers;
      }

      await this.batchRepository.save(batch);

      // Fetch complete batch with relations
      const updatedBatch = await this.batchRepository.findOne({
        where: { id: batch.id },
        relations: ['program', 'centers'],
      });

      res.json({
        status: 'success',
        message: 'Batch updated successfully',
        data: { batch: updatedBatch },
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to update batch',
      });
    }
  }

  // Delete batch
  async deleteBatch(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const batch = await this.batchRepository.findOne({
        where: { id },
        relations: ['enrollments', 'schedules'],
      });

      if (!batch) {
        return res.status(404).json({
          status: 'error',
          message: 'Batch not found',
        });
      }

      // Check if batch has active enrollments
      const activeEnrollments = batch.enrollments.filter(e => e.status === 'ACTIVE');

      if (activeEnrollments.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: `Cannot delete batch with ${activeEnrollments.length} active enrollments`,
        });
      }

      // Delete batch
      await this.batchRepository.remove(batch);

      res.json({
        status: 'success',
        message: 'Batch deleted successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to delete batch',
      });
    }
  }

  // Get batch statistics
  async getBatchStats(req: Request, res: Response) {
    try {
      const totalBatches = await this.batchRepository.count();

      const activeBatches = await this.batchRepository.count({
        where: { status: BatchStatus.ACTIVE },
      });

      const upcomingBatches = await this.batchRepository.count({
        where: { status: BatchStatus.UPCOMING },
      });

      const completedBatches = await this.batchRepository.count({
        where: { status: BatchStatus.COMPLETED },
      });

      // Get total enrollments across all batches
      const totalEnrollments = await this.enrollmentRepository.count();

      // Get batches with most enrollments
      const batchesWithEnrollments = await this.batchRepository
        .createQueryBuilder('batch')
        .leftJoinAndSelect('batch.program', 'program')
        .leftJoinAndSelect('batch.enrollments', 'enrollments')
        .orderBy('COUNT(enrollments.id)', 'DESC')
        .groupBy('batch.id')
        .addGroupBy('program.id')
        .limit(5)
        .getMany();

      res.json({
        status: 'success',
        data: {
          totalBatches,
          activeBatches,
          upcomingBatches,
          completedBatches,
          totalEnrollments,
          topBatches: batchesWithEnrollments.map(batch => ({
            id: batch.id,
            batchNumber: batch.batchNumber,
            programName: batch.program.programName,
            enrollmentCount: batch.enrollments.length,
          })),
        },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch statistics',
      });
    }
  }

  // Get batches dropdown (for forms)
  async getBatchesDropdown(req: Request, res: Response) {
    try {
      const { programId, status } = req.query;

      const queryBuilder = this.batchRepository
        .createQueryBuilder('batch')
        .leftJoinAndSelect('batch.program', 'program')
        .select([
          'batch.id',
          'batch.batchNumber',
          'batch.startDate',
          'batch.status',
          'program.id',
        ])
        .orderBy('batch.startDate', 'DESC');

      if (programId) {
        queryBuilder.where('batch.programId = :programId', { programId });
      }

      if (status) {
        queryBuilder.andWhere('batch.status = :status', { status });
      }

      const batches = await queryBuilder.getMany();

      res.json({
        status: 'success',
        data: { batches },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch batches',
      });
    }
  }

  // Get batch enrollments
  async getBatchEnrollments(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const batch = await this.batchRepository.findOne({
        where: { id },
        relations: [
          'enrollments',
          'enrollments.student',
          'enrollments.student.user',
          'enrollments.program',
        ],
      });

      if (!batch) {
        return res.status(404).json({
          status: 'error',
          message: 'Batch not found',
        });
      }

      res.json({
        status: 'success',
        data: {
          enrollments: batch.enrollments,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch enrollments',
      });
    }
  }
}

export default new BatchController();
