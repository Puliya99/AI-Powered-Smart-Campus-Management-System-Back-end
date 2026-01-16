import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Quiz } from '../entities/Quiz.entity';
import { QuizQuestion } from '../entities/QuizQuestion.entity';
import { QuizAttempt } from '../entities/QuizAttempt.entity';
import { QuizAnswer } from '../entities/QuizAnswer.entity';
import { QuizViolation } from '../entities/QuizViolation.entity';
import { Module } from '../entities/Module.entity';
import { Lecturer } from '../entities/Lecturer.entity';
import { Student } from '../entities/Student.entity';
import { Enrollment } from '../entities/Enrollment.entity';
import { Role } from '../enums/Role.enum';
import notificationService from '../services/notification.service';
import { NotificationType } from '../enums/NotificationType.enum';

export class QuizController {
  private quizRepository = AppDataSource.getRepository(Quiz);
  private questionRepository = AppDataSource.getRepository(QuizQuestion);
  private attemptRepository = AppDataSource.getRepository(QuizAttempt);
  private answerRepository = AppDataSource.getRepository(QuizAnswer);
  private violationRepository = AppDataSource.getRepository(QuizViolation);
  private moduleRepository = AppDataSource.getRepository(Module);
  private lecturerRepository = AppDataSource.getRepository(Lecturer);
  private studentRepository = AppDataSource.getRepository(Student);

  // Create a new quiz (Lecturer only)
  async createQuiz(req: Request, res: Response) {
    try {
      const { title, description, moduleId, durationMinutes, startTime, endTime } = req.body;
      const userId = (req as any).user.userId;

      const lecturer = await this.lecturerRepository.findOne({
        where: { user: { id: userId } },
      });

      if (!lecturer) {
        return res.status(403).json({ status: 'error', message: 'Only lecturers can create quizzes' });
      }

      const module = await this.moduleRepository.findOne({ where: { id: moduleId } });
      if (!module) {
        return res.status(404).json({ status: 'error', message: 'Module not found' });
      }

      const quiz = this.quizRepository.create();
      quiz.title = title;
      quiz.description = description;
      quiz.module = module;
      quiz.lecturer = lecturer;
      quiz.durationMinutes = durationMinutes;
      quiz.startTime = startTime ? new Date(startTime) : (null as any);
      quiz.endTime = endTime ? new Date(endTime) : (null as any);
      quiz.isPublished = false;

      await this.quizRepository.save(quiz);

      res.status(201).json({ status: 'success', data: { quiz } });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to create quiz' });
    }
  }

  // Add questions to a quiz
  async addQuestions(req: Request, res: Response) {
    try {
      const { quizId } = req.params;
      const { questions } = req.body; // Array of questions

      const quiz = await this.quizRepository.findOne({ where: { id: quizId } });
      if (!quiz) {
        return res.status(404).json({ status: 'error', message: 'Quiz not found' });
      }

      const questionEntities = questions.map((q: any) => 
        this.questionRepository.create({
          ...q,
          quiz,
        })
      );

      await this.questionRepository.save(questionEntities);

      // Update total marks
      const allQuestions = await this.questionRepository.find({ where: { quiz: { id: quizId } } });
      quiz.totalMarks = allQuestions.reduce((acc, q) => acc + Number(q.marks), 0);
      await this.quizRepository.save(quiz);

      res.status(201).json({ status: 'success', message: 'Questions added successfully' });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to add questions' });
    }
  }

  // Update a question
  async updateQuestion(req: Request, res: Response) {
    try {
      const { id } = req.params; // questionId
      const { questionText, optionA, optionB, optionC, optionD, correctOption, marks } = req.body;

      const question = await this.questionRepository.findOne({ 
        where: { id },
        relations: ['quiz', 'quiz.lecturer', 'quiz.lecturer.user']
      });

      if (!question) {
        return res.status(404).json({ status: 'error', message: 'Question not found' });
      }

      const userId = (req as any).user.userId;
      if (question.quiz.lecturer.user.id !== userId && (req as any).user.role !== Role.ADMIN) {
        return res.status(403).json({ status: 'error', message: 'Unauthorized to update this question' });
      }

      question.questionText = questionText || question.questionText;
      question.optionA = optionA || question.optionA;
      question.optionB = optionB || question.optionB;
      question.optionC = optionC || question.optionC;
      question.optionD = optionD || question.optionD;
      question.correctOption = correctOption || question.correctOption;
      question.marks = marks !== undefined ? marks : question.marks;

      await this.questionRepository.save(question);

      // Update total marks
      const allQuestions = await this.questionRepository.find({ where: { quiz: { id: question.quiz.id } } });
      question.quiz.totalMarks = allQuestions.reduce((acc, q) => acc + Number(q.marks), 0);
      await this.quizRepository.save(question.quiz);

      res.json({ status: 'success', data: { question } });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to update question' });
    }
  }

  // Delete a question
  async deleteQuestion(req: Request, res: Response) {
    try {
      const { id } = req.params; // questionId

      const question = await this.questionRepository.findOne({ 
        where: { id },
        relations: ['quiz', 'quiz.lecturer', 'quiz.lecturer.user']
      });

      if (!question) {
        return res.status(404).json({ status: 'error', message: 'Question not found' });
      }

      const userId = (req as any).user.userId;
      if (question.quiz.lecturer.user.id !== userId && (req as any).user.role !== Role.ADMIN) {
        return res.status(403).json({ status: 'error', message: 'Unauthorized to delete this question' });
      }

      const quizId = question.quiz.id;
      const quiz = question.quiz;

      await this.questionRepository.remove(question);

      // Update total marks
      const allQuestions = await this.questionRepository.find({ where: { quiz: { id: quizId } } });
      quiz.totalMarks = allQuestions.reduce((acc, q) => acc + Number(q.marks), 0);
      await this.quizRepository.save(quiz);

      res.json({ status: 'success', message: 'Question deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to delete question' });
    }
  }

  // Publish a quiz
  async publishQuiz(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const quiz = await this.quizRepository.findOne({ 
        where: { id },
        relations: ['module', 'module.program']
      });
      if (!quiz) {
        return res.status(404).json({ status: 'error', message: 'Quiz not found' });
      }

      quiz.isPublished = true;
      await this.quizRepository.save(quiz);

      // Notify students about new quiz
      try {
        const enrollmentRepository = AppDataSource.getRepository(Enrollment);
        const enrollments = await enrollmentRepository.find({
          where: { program: { id: quiz.module.program.id }, status: 'ACTIVE' as any },
          relations: ['student', 'student.user']
        });

        const studentUserIds = enrollments.map(e => e.student.user.id);
        
        if (studentUserIds.length > 0) {
          await notificationService.createNotifications({
            userIds: studentUserIds,
            title: `New Quiz: ${quiz.title}`,
            message: `A new quiz has been published for ${quiz.module.moduleName}.`,
            type: NotificationType.GENERAL,
            link: `/student/quizzes`,
            sendEmail: true
          });
        }
      } catch (notifyError) {
        console.error('Failed to notify students about new quiz:', notifyError);
      }

      res.json({ status: 'success', message: 'Quiz published successfully' });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to publish quiz' });
    }
  }

  // Update a quiz
  async updateQuiz(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { title, description, durationMinutes, startTime, endTime } = req.body;
      const userId = (req as any).user.userId;

      const quiz = await this.quizRepository.findOne({
        where: { id },
        relations: ['lecturer', 'lecturer.user'],
      });

      if (!quiz) {
        return res.status(404).json({ status: 'error', message: 'Quiz not found' });
      }

      if (quiz.lecturer.user.id !== userId && (req as any).user.role !== Role.ADMIN) {
        return res.status(403).json({ status: 'error', message: 'Unauthorized to update this quiz' });
      }

      quiz.title = title || quiz.title;
      quiz.description = description || quiz.description;
      quiz.durationMinutes = durationMinutes || quiz.durationMinutes;
      quiz.startTime = startTime ? new Date(startTime) : (quiz.startTime as any);
      quiz.endTime = endTime ? new Date(endTime) : (quiz.endTime as any);

      await this.quizRepository.save(quiz);

      res.json({ status: 'success', data: { quiz } });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to update quiz' });
    }
  }

  // Delete a quiz
  async deleteQuiz(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user.userId;

      const quiz = await this.quizRepository.findOne({
        where: { id },
        relations: ['lecturer', 'lecturer.user'],
      });

      if (!quiz) {
        return res.status(404).json({ status: 'error', message: 'Quiz not found' });
      }

      if (quiz.lecturer.user.id !== userId && (req as any).user.role !== Role.ADMIN) {
        return res.status(403).json({ status: 'error', message: 'Unauthorized to delete this quiz' });
      }

      await this.quizRepository.remove(quiz);

      res.json({ status: 'success', message: 'Quiz deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to delete quiz' });
    }
  }

  // Get quizzes for a module
  async getQuizzesByModule(req: Request, res: Response) {
    try {
      const { moduleId } = req.params;
      const role = (req as any).user.role;

      const where: any = { module: { id: moduleId } };
      if (role === Role.STUDENT) {
        where.isPublished = true;
      }

      const quizzes = await this.quizRepository.find({
        where,
        order: { createdAt: 'DESC' },
      });

      if (role === Role.STUDENT) {
        const student = await this.studentRepository.findOne({
          where: { user: { id: (req as any).user.userId } }
        });

        if (student) {
          const quizzesWithStatus = await Promise.all(quizzes.map(async (quiz) => {
            const attempt = await this.attemptRepository.findOne({
              where: { quiz: { id: quiz.id }, student: { id: student.id } }
            });

            let finalStatus: string | null = attempt ? attempt.status : null;
            if (attempt && (attempt.status === 'SUBMITTED' || attempt.status === 'TIMED_OUT')) {
              const startTime = new Date(attempt.startTime).getTime();
              const now = new Date().getTime();
              const durationMs = quiz.durationMinutes * 60 * 1000;
              // Use 10s grace period consistent with startAttempt
              if (now < (startTime + durationMs + 10000)) {
                finalStatus = 'IN_PROGRESS'; // Mask as IN_PROGRESS if time is not up
              }
            }

            return {
              ...quiz,
              attemptStatus: finalStatus,
              attemptId: attempt ? attempt.id : (null as any)
            };
          }));
          return res.json({ status: 'success', data: { quizzes: quizzesWithStatus } });
        }
      }

      res.json({ status: 'success', data: { quizzes } });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to fetch quizzes' });
    }
  }

  // Get quiz details (with questions for Lecturer, without correct options for Student during attempt)
  async getQuizById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const role = (req as any).user.role;

      const quiz = await this.quizRepository.findOne({
        where: { id },
        relations: ['questions', 'lecturer', 'lecturer.user', 'module'],
      });

      if (!quiz) {
        return res.status(404).json({ status: 'error', message: 'Quiz not found' });
      }

      // If student is fetching, remove correct options unless they already finished it
      if (role === Role.STUDENT) {
        quiz.questions = quiz.questions.map(q => {
          const { correctOption, ...rest } = q;
          return rest as any;
        });
      }

      res.json({ status: 'success', data: { quiz } });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to fetch quiz' });
    }
  }

  // Start quiz attempt (Student)
  async startAttempt(req: Request, res: Response) {
    try {
      const { quizId } = req.params;
      const userId = (req as any).user.userId;

      const student = await this.studentRepository.findOne({ where: { user: { id: userId } } });
      if (!student) {
        return res.status(403).json({ status: 'error', message: 'Only students can attempt quizzes' });
      }

      const quiz = await this.quizRepository.findOne({ where: { id: quizId } });
      if (!quiz) {
        return res.status(404).json({ status: 'error', message: 'Quiz not found' });
      }

      // Check if already attempted
      const existingAttempt = await this.attemptRepository.findOne({
        where: { quiz: { id: quizId }, student: { id: student.id } },
        relations: ['answers', 'answers.question', 'quiz'],
      });

      if (existingAttempt) {
        // If it was cancelled by lecturer or student, and NOT restarted, check if it can be resumed
        // Actually, if it's CANCELLED, we only allow resume if lecturer restarts it (which sets it back to IN_PROGRESS)
        
        const startTime = new Date(existingAttempt.startTime).getTime();
        const now = new Date().getTime();
        const durationMs = existingAttempt.quiz.durationMinutes * 60 * 1000;
        
        // Add a small grace period (e.g. 10 seconds) to ensure the client doesn't get blocked by minor network delays/drift
        const isTimeUp = now >= (startTime + durationMs + 10000);

        if (existingAttempt.status === 'IN_PROGRESS' || existingAttempt.status === 'TIMED_OUT' || (!isTimeUp && existingAttempt.status === 'SUBMITTED')) {
          // Allow resume if in progress, timed out (but still has time), or if time is not up even if submitted
          if (existingAttempt.status === 'SUBMITTED' || existingAttempt.status === 'TIMED_OUT') {
            existingAttempt.status = 'IN_PROGRESS';
            await this.attemptRepository.save(existingAttempt);
          }
          return res.json({ status: 'success', data: { attempt: existingAttempt } });
        }
        
        // If it was cancelled or timed out or time is up, don't allow re-entry
        let errorMessage = 'You have already attempted this quiz';
        if (existingAttempt.status === 'CANCELLED') errorMessage = 'This attempt was cancelled due to a security violation';
        else if (isTimeUp) errorMessage = 'The time for this quiz attempt has expired';

        return res.status(400).json({ status: 'error', message: errorMessage });
      }

      const attempt = this.attemptRepository.create({
        quiz,
        student,
        startTime: new Date(),
        status: 'IN_PROGRESS',
      });

      await this.attemptRepository.save(attempt);

      res.status(201).json({ status: 'success', data: { attempt } });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to start attempt' });
    }
  }

  // Restart quiz attempt (Lecturer only)
  async restartAttempt(req: Request, res: Response) {
    try {
      const { id } = req.params; // attemptId
      const userId = (req as any).user.userId;

      const attempt = await this.attemptRepository.findOne({
        where: { id },
        relations: ['quiz', 'quiz.lecturer', 'quiz.lecturer.user', 'answers'],
      });

      if (!attempt) {
        return res.status(404).json({ status: 'error', message: 'Attempt not found' });
      }

      // Authorization check
      if (attempt.quiz.lecturer.user.id !== userId && (req as any).user.role !== Role.ADMIN) {
        return res.status(403).json({ status: 'error', message: 'Unauthorized to restart this attempt' });
      }

      // Delete existing answers
      if (attempt.answers && attempt.answers.length > 0) {
        await this.answerRepository.remove(attempt.answers);
      }

      // Reset attempt details
      attempt.status = 'IN_PROGRESS';
      attempt.startTime = new Date(); // Reset start time to give full duration
      attempt.submittedTime = (null as any);
      attempt.score = 0;
      attempt.reason = (null as any);

      await this.attemptRepository.save(attempt);

      res.json({ status: 'success', message: 'Attempt restarted successfully', data: { attempt } });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to restart attempt' });
    }
  }

  // Submit quiz attempt
  async submitAttempt(req: Request, res: Response) {
    try {
      const { id } = req.params; // attemptId
      const { answers } = req.body; // Array of { questionId, selectedOption }

      const attempt = await this.attemptRepository.findOne({
        where: { id },
        relations: ['quiz', 'quiz.questions'],
      });

      if (!attempt) {
        return res.status(404).json({ status: 'error', message: 'Attempt not found' });
      }

      if (attempt.status !== 'IN_PROGRESS') {
        return res.status(400).json({ status: 'error', message: 'Attempt already submitted or timed out' });
      }

      // Delete existing answers if any (to support re-submission/update)
      if (attempt.answers && attempt.answers.length > 0) {
        await this.answerRepository.remove(attempt.answers);
      }

      let score = 0;
      const answerEntities = [];

      for (const q of attempt.quiz.questions) {
        const studentAnswer = answers.find((a: any) => a.questionId === q.id);
        const isCorrect = studentAnswer?.selectedOption === q.correctOption;
        
        if (isCorrect) {
          score += Number(q.marks);
        }

        answerEntities.push(this.answerRepository.create({
          attempt,
          question: q,
          selectedOption: studentAnswer?.selectedOption || (null as any),
          isCorrect,
        }));
      }

      await this.answerRepository.save(answerEntities);

      attempt.score = score;
      attempt.submittedTime = new Date();
      attempt.status = 'SUBMITTED';
      await this.attemptRepository.save(attempt);

      res.json({ status: 'success', data: { attempt } });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to submit attempt' });
    }
  }

  // Get attempt results
  async getAttemptResults(req: Request, res: Response) {
    try {
      const { id } = req.params; // attemptId
      const userId = (req as any).user.userId;
      const role = (req as any).user.role;

      const attempt = await this.attemptRepository.findOne({
        where: { id },
        relations: ['quiz', 'quiz.module', 'quiz.questions', 'answers', 'answers.question'],
      });

      if (!attempt) {
        return res.status(404).json({ status: 'error', message: 'Attempt not found' });
      }

      // If student is fetching, check if time is up
      if (role === Role.STUDENT) {
        const startTime = new Date(attempt.startTime).getTime();
        const now = new Date().getTime();
        const durationMs = attempt.quiz.durationMinutes * 60 * 1000;
        const isTimeUp = now >= (startTime + durationMs + 10000); // 10s grace period

        // Hide results if time is not up AND it wasn't cancelled
        if (!isTimeUp && attempt.status !== 'CANCELLED') {
          return res.json({ 
            status: 'success', 
            data: { 
              attempt: {
                ...attempt,
                score: null,
                answers: [], // Hide answers
                isResultsPending: true
              }
            } 
          });
        }
      }

      res.json({ status: 'success', data: { attempt } });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to fetch results' });
    }
  }

  // Get all attempts for a quiz (Lecturer only)
  async getQuizAttempts(req: Request, res: Response) {
    try {
      const { quizId } = req.params;
      const attempts = await this.attemptRepository.find({
        where: { quiz: { id: quizId } },
        relations: ['student', 'student.user'],
        order: { submittedTime: 'DESC' },
      });

      res.json({ status: 'success', data: { attempts } });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to fetch attempts' });
    }
  }

  // Report a quiz violation and potentially cancel the attempt
  async reportViolation(req: Request, res: Response) {
    try {
      const { attemptId } = req.params;
      const { violationType, details, shouldCancel } = req.body;

      const attempt = await this.attemptRepository.findOne({
        where: { id: attemptId },
        relations: ['quiz', 'student', 'student.user'],
      });

      if (!attempt) {
        return res.status(404).json({ status: 'error', message: 'Attempt not found' });
      }

      if (attempt.status === 'SUBMITTED' || attempt.status === 'CANCELLED') {
        return res.status(400).json({ status: 'error', message: 'Attempt is already finished' });
      }

      const violation = this.violationRepository.create({
        attempt,
        violationType,
        details,
        timestamp: new Date(),
      });

      await this.violationRepository.save(violation);

      // Check violation counts for this attempt
      const violationCount = await this.violationRepository.count({
        where: { attempt: { id: attemptId } }
      });

      let responseMessage = 'Violation reported';
      let cancelled = false;

      // Logic: Cancel only if explicitly requested (e.g. serious violation or persistent for 10s) 
      // OR if it's the 5th violation (multiple warnings given first)
      if (shouldCancel || violationCount >= 5) {
        attempt.status = 'CANCELLED';
        attempt.reason = details || `Multiple security violations reported (Type: ${violationType})`;
        attempt.submittedTime = new Date();
        await this.attemptRepository.save(attempt);
        cancelled = true;
        responseMessage = `Attempt cancelled: ${details || 'Security violation'}`;
      } else {
        responseMessage = `Security Warning (${violationCount}/5): ${violationType}. Correction required!`;
      }

      res.status(201).json({ 
        status: 'success', 
        message: responseMessage, 
        data: { 
          cancelled,
          violationCount,
          warning: !cancelled
        } 
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to report violation' });
    }
  }

  // Get violations for an attempt
  async getAttemptViolations(req: Request, res: Response) {
    try {
      const { attemptId } = req.params;
      const violations = await this.violationRepository.find({
        where: { attempt: { id: attemptId } },
        order: { timestamp: 'ASC' },
      });

      res.json({ status: 'success', data: { violations } });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to fetch violations' });
    }
  }
}

export default new QuizController();
