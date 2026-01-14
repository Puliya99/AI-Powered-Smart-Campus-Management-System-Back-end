import { Router } from 'express';
import quizController from '../controllers/quiz.controller';
import authMiddleware from '../middleware/auth.middleware';
import { Role } from '../enums/Role.enum';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate.bind(authMiddleware));

// Create quiz (Lecturer only)
router.post(
  '/',
  authMiddleware.authorize(Role.LECTURER),
  quizController.createQuiz.bind(quizController)
);

// Get quizzes by module
router.get('/module/:moduleId', quizController.getQuizzesByModule.bind(quizController));

// Get quiz by ID
router.get('/:id', quizController.getQuizById.bind(quizController));

// Add questions (Lecturer only)
router.post(
  '/:quizId/questions',
  authMiddleware.authorize(Role.LECTURER),
  quizController.addQuestions.bind(quizController)
);

// Publish quiz (Lecturer only)
router.put(
  '/:id/publish',
  authMiddleware.authorize(Role.LECTURER),
  quizController.publishQuiz.bind(quizController)
);

// Update quiz (Lecturer only)
router.put(
  '/:id',
  authMiddleware.authorize(Role.LECTURER),
  quizController.updateQuiz.bind(quizController)
);

// Delete quiz (Lecturer only)
router.delete(
  '/:id',
  authMiddleware.authorize(Role.LECTURER),
  quizController.deleteQuiz.bind(quizController)
);

// Update question (Lecturer only)
router.put(
  '/questions/:id',
  authMiddleware.authorize(Role.LECTURER),
  quizController.updateQuestion.bind(quizController)
);

// Delete question (Lecturer only)
router.delete(
  '/questions/:id',
  authMiddleware.authorize(Role.LECTURER),
  quizController.deleteQuestion.bind(quizController)
);

// Start attempt (Student only)
router.post(
  '/:quizId/start',
  authMiddleware.authorize(Role.STUDENT),
  quizController.startAttempt.bind(quizController)
);

// Submit attempt (Student only)
router.post(
  '/attempts/:id/submit',
  authMiddleware.authorize(Role.STUDENT),
  quizController.submitAttempt.bind(quizController)
);

// Get attempt results
router.get('/attempts/:id', quizController.getAttemptResults.bind(quizController));

// Get all attempts for a quiz (Lecturer only)
router.get(
  '/:quizId/attempts',
  authMiddleware.authorize(Role.LECTURER),
  quizController.getQuizAttempts.bind(quizController)
);

// Report violation (Student only)
router.post(
  '/attempts/:attemptId/violations',
  authMiddleware.authorize(Role.STUDENT),
  quizController.reportViolation.bind(quizController)
);

// Get violations (Lecturer and Admin)
router.get(
  '/attempts/:attemptId/violations',
  authMiddleware.authorize(Role.LECTURER, Role.ADMIN),
  quizController.getAttemptViolations.bind(quizController)
);

export default router;
