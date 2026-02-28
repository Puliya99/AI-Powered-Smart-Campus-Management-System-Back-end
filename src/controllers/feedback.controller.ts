import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Feedback } from '../entities/Feedback.entity';
import { Student } from '../entities/Student.entity';
import { Module } from '../entities/Module.entity';
import { Enrollment } from '../entities/Enrollment.entity';

export class FeedbackController {
  private feedbackRepository = AppDataSource.getRepository(Feedback);
  private studentRepository = AppDataSource.getRepository(Student);
  private moduleRepository = AppDataSource.getRepository(Module);
  private enrollmentRepository = AppDataSource.getRepository(Enrollment);

  // Submit feedback (Student only)
  async submitFeedback(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const { moduleId, rating, comment } = req.body;

      // Find student
      const student = await this.studentRepository.findOne({
        where: { user: { id: userId } },
      });

      if (!student) {
        return res.status(404).json({
          status: 'error',
          message: 'Student record not found',
        });
      }

      // Verify module exists
      const module = await this.moduleRepository.findOne({
        where: { id: moduleId },
      });

      if (!module) {
        return res.status(404).json({
          status: 'error',
          message: 'Module not found',
        });
      }

      // Verify enrollment
      const studentWithPrograms = await this.studentRepository.findOne({
        where: { id: student.id },
        relations: ['enrollments', 'enrollments.program', 'enrollments.program.modules']
      });

      const isEnrolled = studentWithPrograms?.enrollments.some(e => 
        e.program.modules.some(m => m.id === moduleId)
      );

      if (!isEnrolled) {
        return res.status(403).json({
          status: 'error',
          message: 'You can only provide feedback for modules you are enrolled in',
        });
      }

      // Check if already provided feedback for this module
      const existingFeedback = await this.feedbackRepository.findOne({
        where: { 
          student: { id: student.id },
          module: { id: moduleId }
        },
      });

      if (existingFeedback) {
        return res.status(400).json({
          status: 'error',
          message: 'You have already provided feedback for this module',
        });
      }

      // Create feedback
      const feedback = this.feedbackRepository.create({
        rating,
        comment,
        feedbackDate: new Date(),
        student,
        module,
      });

      // Optional: AI Sentiment Analysis placeholder
      // feedback.sentiment = analyzeSentiment(comment);

      await this.feedbackRepository.save(feedback);

      res.status(201).json({
        status: 'success',
        message: 'Feedback submitted successfully',
        data: { feedback },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to submit feedback',
      });
    }
  }

  // Get my feedbacks (Student only)
  async getMyFeedbacks(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;

      const student = await this.studentRepository.findOne({
        where: { user: { id: userId } },
      });

      if (!student) {
        return res.status(404).json({
          status: 'error',
          message: 'Student record not found',
        });
      }

      const feedbacks = await this.feedbackRepository.find({
        where: { student: { id: student.id } },
        relations: ['module'],
        order: { feedbackDate: 'DESC' },
      });

      res.json({
        status: 'success',
        data: { feedbacks },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch feedbacks',
      });
    }
  }

  // Get feedbacks for a module (Admin/Lecturer/Staff)
  async getModuleFeedbacks(req: Request, res: Response) {
    try {
      const { moduleId } = req.params;

      const feedbacks = await this.feedbackRepository.find({
        where: { module: { id: moduleId } },
        relations: ['student', 'student.user'],
        order: { feedbackDate: 'DESC' },
      });

      res.json({
        status: 'success',
        data: { feedbacks },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch module feedbacks',
      });
    }
  }

  // Get all feedbacks with filters (Admin/Staff)
  async getAllFeedbacks(req: Request, res: Response) {
    try {
      const {
        page = 1,
        limit = 10,
        moduleId,
        rating,
        sentiment,
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      const queryBuilder = this.feedbackRepository
        .createQueryBuilder('feedback')
        .leftJoinAndSelect('feedback.student', 'student')
        .leftJoinAndSelect('student.user', 'user')
        .leftJoinAndSelect('feedback.module', 'module')
        .skip(skip)
        .take(Number(limit))
        .orderBy('feedback.feedbackDate', 'DESC');

      if (moduleId) {
        queryBuilder.andWhere('module.id = :moduleId', { moduleId });
      }

      if (rating) {
        queryBuilder.andWhere('feedback.rating = :rating', { rating: Number(rating) });
      }

      if (sentiment) {
        queryBuilder.andWhere('feedback.sentiment = :sentiment', { sentiment });
      }

      const [feedbacks, total] = await queryBuilder.getManyAndCount();

      res.json({
        status: 'success',
        data: {
          feedbacks,
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
        message: error.message || 'Failed to fetch all feedbacks',
      });
    }
  }
}

export default new FeedbackController();
