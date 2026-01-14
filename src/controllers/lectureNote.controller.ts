import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { LectureNote } from '../entities/LectureNote.entity';
import { Module } from '../entities/Module.entity';
import { Lecturer } from '../entities/Lecturer.entity';
import { Student } from '../entities/Student.entity';
import { Enrollment } from '../entities/Enrollment.entity';
import { Role } from '../enums/Role.enum';

export class LectureNoteController {
  private lectureNoteRepository = AppDataSource.getRepository(LectureNote);
  private moduleRepository = AppDataSource.getRepository(Module);
  private lecturerRepository = AppDataSource.getRepository(Lecturer);
  private studentRepository = AppDataSource.getRepository(Student);
  private enrollmentRepository = AppDataSource.getRepository(Enrollment);

  // Get materials for a module
  async getMaterialsByModule(req: Request, res: Response) {
    try {
      const { moduleId } = req.params;
      const user = (req as any).user;

      // Permission check for students
      if (user.role === Role.STUDENT) {
        const student = await this.studentRepository.findOne({
          where: { user: { id: user.userId } },
        });

        if (!student) {
          return res.status(403).json({
            status: 'error',
            message: 'Student profile not found',
          });
        }

        // Check if student is enrolled in a program that includes this module
        const module = await this.moduleRepository.findOne({
          where: { id: moduleId },
          relations: ['program'],
        });

        if (!module) {
          return res.status(404).json({
            status: 'error',
            message: 'Module not found',
          });
        }

        const enrollment = await this.enrollmentRepository.findOne({
          where: {
            student: { id: student.id },
            program: { id: module.program.id },
            status: 'ACTIVE' as any,
          },
        });

        if (!enrollment) {
          return res.status(403).json({
            status: 'error',
            message: 'You are not enrolled in the program for this module',
          });
        }
      }

      const materials = await this.lectureNoteRepository.find({
        where: { module: { id: moduleId } },
        relations: ['lecturer', 'lecturer.user'],
        order: { uploadDate: 'DESC' },
      });

      res.json({
        status: 'success',
        data: { materials },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch materials',
      });
    }
  }

  // Create new material (Lecturer only)
  async createMaterial(req: Request, res: Response) {
    try {
      const { title, type, content, moduleId } = req.body;
      let { fileUrl } = req.body;
      const user = (req as any).user;

      // Check if file was uploaded
      if (req.file) {
        fileUrl = `/uploads/${req.file.filename}`;
      }

      const lecturer = await this.lecturerRepository.findOne({
        where: { user: { id: user.userId } },
      });

      if (!lecturer) {
        return res.status(403).json({
          status: 'error',
          message: 'Lecturer profile not found',
        });
      }

      const module = await this.moduleRepository.findOne({
        where: { id: moduleId },
        relations: ['lecturer'],
      });

      if (!module) {
        return res.status(404).json({
          status: 'error',
          message: 'Module not found',
        });
      }

      // Check if lecturer is assigned to this module
      if (module.lecturer.id !== lecturer.id) {
        return res.status(403).json({
          status: 'error',
          message: 'You are not assigned to this module',
        });
      }

      const material = this.lectureNoteRepository.create({
        title,
        type,
        content,
        fileUrl,
        uploadDate: new Date(),
        lecturer,
        module,
      });

      await this.lectureNoteRepository.save(material);

      res.status(201).json({
        status: 'success',
        message: 'Material shared successfully',
        data: { material },
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to share material',
      });
    }
  }

  // Delete material (Lecturer only)
  async deleteMaterial(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      const lecturer = await this.lecturerRepository.findOne({
        where: { user: { id: user.userId } },
      });

      if (!lecturer) {
        return res.status(403).json({
          status: 'error',
          message: 'Lecturer profile not found',
        });
      }

      const material = await this.lectureNoteRepository.findOne({
        where: { id },
        relations: ['lecturer'],
      });

      if (!material) {
        return res.status(404).json({
          status: 'error',
          message: 'Material not found',
        });
      }

      if (material.lecturer.id !== lecturer.id && user.role !== Role.ADMIN) {
        return res.status(403).json({
          status: 'error',
          message: 'You can only delete your own materials',
        });
      }

      await this.lectureNoteRepository.remove(material);

      res.json({
        status: 'success',
        message: 'Material deleted successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to delete material',
      });
    }
  }
}

export default new LectureNoteController();
