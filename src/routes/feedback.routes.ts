import { Router } from 'express';
import feedbackController from '../controllers/feedback.controller';
import authMiddleware from '../middleware/auth.middleware';
import { Role } from '../enums/Role.enum';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate.bind(authMiddleware));

// Submit feedback (Student only)
router.post(
  '/',
  authMiddleware.authorize(Role.STUDENT),
  feedbackController.submitFeedback.bind(feedbackController)
);

// Get my feedbacks (Student only)
router.get(
  '/my-feedbacks',
  authMiddleware.authorize(Role.STUDENT),
  feedbackController.getMyFeedbacks.bind(feedbackController)
);

// Get all feedbacks (Admin and Staff only)
router.get(
  '/',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  feedbackController.getAllFeedbacks.bind(feedbackController)
);

// Get feedbacks for a specific module (Admin, Staff, and Lecturer)
router.get(
  '/module/:moduleId',
  authMiddleware.authorize(Role.ADMIN, Role.USER, Role.LECTURER),
  feedbackController.getModuleFeedbacks.bind(feedbackController)
);

export default router;
