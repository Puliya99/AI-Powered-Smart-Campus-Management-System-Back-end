import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Result } from '../entities/Result.entity';
import { Module } from '../entities/Module.entity';
import { Student } from '../entities/Student.entity';
import { Lecturer } from '../entities/Lecturer.entity';
import { Enrollment } from '../entities/Enrollment.entity';
import { Role } from '../enums/Role.enum';
import { ResultStatus } from '../enums/ResultStatus.enum';
import notificationService from '../services/notification.service';
import { NotificationType } from '../enums/NotificationType.enum';

export class ResultController {
  private resultRepository = AppDataSource.getRepository(Result);
  private moduleRepository = AppDataSource.getRepository(Module);
  private studentRepository = AppDataSource.getRepository(Student);
  private lecturerRepository = AppDataSource.getRepository(Lecturer);
  private enrollmentRepository = AppDataSource.getRepository(Enrollment);

  // Get results for a module (Lecturer/Admin only)
  async getResultsByModule(req: Request, res: Response) {
    try {
      const { moduleId } = req.params;
      const user = (req as any).user;

      const module = await this.moduleRepository.findOne({
        where: { id: moduleId },
        relations: ['lecturer', 'program']
      });

      if (!module) {
        return res.status(404).json({
          status: 'error',
          message: 'Module not found',
        });
      }

      // Permission check
      if (user.role === Role.LECTURER) {
        const lecturer = await this.lecturerRepository.findOne({
          where: { user: { id: user.userId } },
        });

        if (!lecturer || module.lecturer.id !== lecturer.id) {
          return res.status(403).json({
            status: 'error',
            message: 'You are not authorized to view results for this module',
          });
        }
      } else if (user.role !== Role.ADMIN) {
        return res.status(403).json({
          status: 'error',
          message: 'Insufficient permissions',
        });
      }

      const results = await this.resultRepository.find({
        where: { module: { id: moduleId } },
        relations: ['student', 'student.user'],
        order: { student: { user: { firstName: 'ASC' } } },
      });

      // Also get enrolled students to show who doesn't have a result yet
      const enrollments = await this.enrollmentRepository.find({
        where: { program: { id: module.program.id }, status: 'ACTIVE' as any },
        relations: ['student', 'student.user'],
      });

      res.json({
        status: 'success',
        data: { 
          results,
          enrolledStudents: enrollments.map(e => e.student)
        },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch results',
      });
    }
  }

  // Create or update result
  async upsertResult(req: Request, res: Response) {
    try {
      const { studentId, moduleId, marks, maxMarks, grade, status, examDate, remarks } = req.body;
      const user = (req as any).user;

      const module = await this.moduleRepository.findOne({
        where: { id: moduleId },
        relations: ['lecturer']
      });

      if (!module) {
        return res.status(404).json({ status: 'error', message: 'Module not found' });
      }

      // Permission check
      if (user.role === Role.LECTURER) {
        const lecturer = await this.lecturerRepository.findOne({
          where: { user: { id: user.userId } },
        });
        if (!lecturer || module.lecturer.id !== lecturer.id) {
          return res.status(403).json({ status: 'error', message: 'Unauthorized' });
        }
      } else if (user.role !== Role.ADMIN) {
        return res.status(403).json({ status: 'error', message: 'Insufficient permissions' });
      }

      const student = await this.studentRepository.findOne({ where: { id: studentId } });
      if (!student) {
        return res.status(404).json({ status: 'error', message: 'Student not found' });
      }

      let result = await this.resultRepository.findOne({
        where: { student: { id: studentId }, module: { id: moduleId } }
      });

      if (result) {
        // Update
        result.marks = marks;
        result.maxMarks = maxMarks;
        result.grade = grade;
        result.status = status;
        result.examDate = examDate ? new Date(examDate) : result.examDate;
        result.remarks = remarks;
      } else {
        // Create
        result = this.resultRepository.create({
          student,
          module,
          marks,
          maxMarks,
          grade,
          status: status || ResultStatus.PENDING,
          examDate: examDate ? new Date(examDate) : new Date(),
          remarks
        });
      }

      await this.resultRepository.save(result);

      // Notify student about new/updated result
      try {
        const studentWithUser = await this.studentRepository.findOne({
          where: { id: studentId },
          relations: ['user']
        });

        if (studentWithUser) {
          await notificationService.createNotification({
            userId: studentWithUser.user.id,
            title: `Result Updated: ${module.moduleName}`,
            message: `Your result for ${module.moduleName} has been ${result ? 'updated' : 'added'}. Grade: ${grade || 'N/A'}.`,
            type: NotificationType.RESULT,
            link: '/student/results',
            sendEmail: true
          });
        }
      } catch (notifyError) {
        console.error('Failed to notify student about result:', notifyError);
      }

      res.json({
        status: 'success',
        message: 'Result saved successfully',
        data: { result }
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to save result',
      });
    }
  }

  // Bulk update results
  async bulkUpsertResults(req: Request, res: Response) {
    try {
      const { moduleId, results } = req.body; // results is an array of { studentId, marks, ... }
      const user = (req as any).user;

      const module = await this.moduleRepository.findOne({
        where: { id: moduleId },
        relations: ['lecturer']
      });

      if (!module) {
        return res.status(404).json({ status: 'error', message: 'Module not found' });
      }

      // Permission check
      if (user.role === Role.LECTURER) {
        const lecturer = await this.lecturerRepository.findOne({
          where: { user: { id: user.userId } },
        });
        if (!lecturer || module.lecturer.id !== lecturer.id) {
          return res.status(403).json({ status: 'error', message: 'Unauthorized' });
        }
      }

      for (const resData of results) {
        const { studentId, marks, maxMarks, grade, status, examDate, remarks } = resData;
        
        let result = await this.resultRepository.findOne({
          where: { student: { id: studentId }, module: { id: moduleId } }
        });

        if (result) {
          result.marks = marks;
          result.maxMarks = maxMarks;
          result.grade = grade;
          result.status = status;
          result.examDate = examDate ? new Date(examDate) : result.examDate;
          result.remarks = remarks;
        } else {
          const student = await this.studentRepository.findOne({ where: { id: studentId } });
          if (student) {
            result = this.resultRepository.create({
              student,
              module,
              marks,
              maxMarks,
              grade,
              status: status || ResultStatus.PENDING,
              examDate: examDate ? new Date(examDate) : new Date(),
              remarks
            });
          }
        }
        if (result) {
          await this.resultRepository.save(result);
          
          // Notify student (Bulk update)
          try {
            const studentWithUser = await this.studentRepository.findOne({
              where: { id: studentId },
              relations: ['user']
            });

            if (studentWithUser) {
              await notificationService.createNotification({
                userId: studentWithUser.user.id,
                title: `Result Published: ${module.moduleName}`,
                message: `Your result for ${module.moduleName} has been published/updated. Grade: ${grade || 'N/A'}.`,
                type: NotificationType.RESULT,
                link: '/student/results',
                sendEmail: true
              });
            }
          } catch (notifyError) {
            console.error('Failed to notify student in bulk update:', notifyError);
          }
        }
      }

      res.json({
        status: 'success',
        message: 'Results updated successfully'
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to update results',
      });
    }
  }

  // Delete result
  async deleteResult(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      const result = await this.resultRepository.findOne({
        where: { id },
        relations: ['module', 'module.lecturer']
      });

      if (!result) {
        return res.status(404).json({ status: 'error', message: 'Result not found' });
      }

      // Permission check
      if (user.role === Role.LECTURER) {
        const lecturer = await this.lecturerRepository.findOne({
          where: { user: { id: user.userId } },
        });
        if (!lecturer || result.module.lecturer.id !== lecturer.id) {
          return res.status(403).json({ status: 'error', message: 'Unauthorized' });
        }
      } else if (user.role !== Role.ADMIN) {
        return res.status(403).json({ status: 'error', message: 'Insufficient permissions' });
      }

      await this.resultRepository.remove(result);

      res.json({
        status: 'success',
        message: 'Result deleted successfully'
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to delete result',
      });
    }
  }

  // Get student's own results
  async getMyResults(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      
      const student = await this.studentRepository.findOne({
        where: { user: { id: userId } }
      });

      if (!student) {
        return res.status(404).json({ status: 'error', message: 'Student profile not found' });
      }

      const results = await this.resultRepository.find({
        where: { student: { id: student.id } },
        relations: ['module'],
        order: { module: { moduleName: 'ASC' } }
      });

      res.json({
        status: 'success',
        data: { results }
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch your results',
      });
    }
  }
}

export default new ResultController();