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
import { Role } from '../enums/Role.enum';

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

      const quiz = this.quizRepository.create({
        title,
        description,
        module,
        lecturer,
        durationMinutes,
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        isPublished: false,
      });

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
      const quiz = await this.quizRepository.findOne({ where: { id } });
      if (!quiz) {
        return res.status(404).json({ status: 'error', message: 'Quiz not found' });
      }

      quiz.isPublished = true;
      await this.quizRepository.save(quiz);

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
      quiz.startTime = startTime ? new Date(startTime) : quiz.startTime;
      quiz.endTime = endTime ? new Date(endTime) : quiz.endTime;

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
      });

      if (existingAttempt) {
        return res.status(400).json({ status: 'error', message: 'You have already attempted this quiz' });
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
          selectedOption: studentAnswer?.selectedOption || null,
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

      const attempt = await this.attemptRepository.findOne({
        where: { id },
        relations: ['quiz', 'quiz.questions', 'answers', 'answers.question'],
      });

      if (!attempt) {
        return res.status(404).json({ status: 'error', message: 'Attempt not found' });
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

      if (shouldCancel) {
        attempt.status = 'CANCELLED';
        attempt.reason = details || `Auto-cancelled due to ${violationType}`;
        attempt.submittedTime = new Date();
        await this.attemptRepository.save(attempt);
      }

      res.status(201).json({ 
        status: 'success', 
        message: 'Violation reported', 
        data: { cancelled: !!shouldCancel } 
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
