import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Center } from '../entities/Center.entity';

export class CenterController {
  private centerRepository = AppDataSource.getRepository(Center);

  // Get all centers with pagination and filters
  async getAllCenters(req: Request, res: Response) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        sortBy = 'createdAt',
        sortOrder = 'DESC',
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      const queryBuilder = this.centerRepository
        .createQueryBuilder('center')
        .leftJoinAndSelect('center.users', 'users')
        .leftJoinAndSelect('center.lecturers', 'lecturers')
        .leftJoinAndSelect('center.schedules', 'schedules')
        .skip(skip)
        .take(Number(limit))
        .orderBy(`center.${sortBy}`, sortOrder as 'ASC' | 'DESC');

      // Search filter
      if (search) {
        queryBuilder.where(
          '(center.centerName ILIKE :search OR center.centerCode ILIKE :search OR center.branch ILIKE :search)',
          { search: `%${search}%` }
        );
      }

      const [centers, total] = await queryBuilder.getManyAndCount();

      // Add statistics for each center
      const centersWithStats = centers.map(center => ({
        ...center,
        stats: {
          userCount: center.users?.length || 0,
          lecturerCount: center.lecturers?.length || 0,
          scheduleCount: center.schedules?.length || 0,
        },
      }));

      res.json({
        status: 'success',
        data: {
          centers: centersWithStats,
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
        message: error.message || 'Failed to fetch centers',
      });
    }
  }

  // Get center by ID
  async getCenterById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const center = await this.centerRepository.findOne({
        where: { id },
        relations: ['users', 'lecturers', 'lecturers.user', 'schedules'],
      });

      if (!center) {
        return res.status(404).json({
          status: 'error',
          message: 'Center not found',
        });
      }

      res.json({
        status: 'success',
        data: { center },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch center',
      });
    }
  }

  // Create new center
  async createCenter(req: Request, res: Response) {
    try {
      const { centerCode, centerName, branch, address, phone } = req.body;

      // Check if center code already exists
      const existingCenter = await this.centerRepository.findOne({
        where: { centerCode },
      });

      if (existingCenter) {
        return res.status(400).json({
          status: 'error',
          message: 'Center code already exists',
        });
      }

      // Create center
      const center = this.centerRepository.create({
        centerCode,
        centerName,
        branch,
        address,
        phone,
      });

      await this.centerRepository.save(center);

      res.status(201).json({
        status: 'success',
        message: 'Center created successfully',
        data: { center },
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to create center',
      });
    }
  }

  // Update center
  async updateCenter(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { centerCode, centerName, branch, address, phone } = req.body;

      const center = await this.centerRepository.findOne({
        where: { id },
      });

      if (!center) {
        return res.status(404).json({
          status: 'error',
          message: 'Center not found',
        });
      }

      // Check if new center code conflicts
      if (centerCode && centerCode !== center.centerCode) {
        const existingCenter = await this.centerRepository.findOne({
          where: { centerCode },
        });

        if (existingCenter) {
          return res.status(400).json({
            status: 'error',
            message: 'Center code already exists',
          });
        }
      }

      // Update fields
      if (centerCode) center.centerCode = centerCode;
      if (centerName) center.centerName = centerName;
      if (branch) center.branch = branch;
      if (address !== undefined) center.address = address;
      if (phone !== undefined) center.phone = phone;

      await this.centerRepository.save(center);

      res.json({
        status: 'success',
        message: 'Center updated successfully',
        data: { center },
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to update center',
      });
    }
  }

  // Delete center
  async deleteCenter(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const center = await this.centerRepository.findOne({
        where: { id },
        relations: ['users', 'lecturers', 'schedules'],
      });

      if (!center) {
        return res.status(404).json({
          status: 'error',
          message: 'Center not found',
        });
      }

      // Prevent deletion if center has associated records
      if (
        (center.users && center.users.length > 0) ||
        (center.lecturers && center.lecturers.length > 0) ||
        (center.schedules && center.schedules.length > 0)
      ) {
        return res.status(400).json({
          status: 'error',
          message: 'Cannot delete center with associated users, lecturers, or schedules',
        });
      }

      await this.centerRepository.remove(center);

      res.json({
        status: 'success',
        message: 'Center deleted successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to delete center',
      });
    }
  }

  // Get center statistics (for admin dashboard cards)
  async getCenterStats(req: Request, res: Response) {
    try {
      const totalCenters = await this.centerRepository.count();

      const centers = await this.centerRepository.find({
        relations: ['users', 'lecturers', 'schedules'],
      });

      let totalUsers = 0;
      let totalLecturers = 0;
      let totalSchedules = 0;

      centers.forEach(center => {
        totalUsers += center.users?.length || 0;
        totalLecturers += center.lecturers?.length || 0;
        totalSchedules += center.schedules?.length || 0;
      });

      res.json({
        status: 'success',
        data: {
          totalCenters,
          totalUsers,
          totalLecturers,
          totalSchedules,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch statistics',
      });
    }
  }

  // Dropdown for forms (e.g., schedule creation)
  async getCentersDropdown(req: Request, res: Response) {
    try {
      const centers = await this.centerRepository.find({
        select: ['id', 'centerCode', 'centerName'],
        order: { centerName: 'ASC' },
      });

      res.json({
        status: 'success',
        data: { centers },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch centers',
      });
    }
  }
}

export default new CenterController();
