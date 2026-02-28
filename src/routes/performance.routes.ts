import { Router } from 'express';
import performanceController from '../controllers/performance.controller';
import authMiddleware from '../middleware/auth.middleware';
import { Role } from '../enums/Role.enum';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate.bind(authMiddleware));

// Get metrics for a specific module (Lecturer and Admin)
router.get(
  '/module/:moduleId',
  authMiddleware.authorize(Role.LECTURER, Role.ADMIN),
  performanceController.getModulePerformance.bind(performanceController)
);

// Get aggregated metrics for current lecturer
router.get(
  '/lecturer/me',
  authMiddleware.authorize(Role.LECTURER, Role.ADMIN),
  performanceController.getLecturerPerformance.bind(performanceController)
);

// Admin view: All lecturers performance
router.get(
  '/admin/all-lecturers',
  authMiddleware.authorize(Role.ADMIN, Role.LECTURER, Role.STUDENT, Role.USER),
  performanceController.getAllLecturersPerformance.bind(performanceController)
);

// Get performance metrics for a specific batch
router.get(
  '/batch/:batchId',
  authMiddleware.authorize(Role.ADMIN, Role.LECTURER, Role.STUDENT, Role.USER),
  performanceController.getBatchPerformance.bind(performanceController)
);

// Get AI predictions center-wise
router.get(
  '/ai-predictions',
  authMiddleware.authorize(Role.ADMIN, Role.LECTURER, Role.STUDENT, Role.USER),
  performanceController.getCenterPredictions.bind(performanceController)
);

export default router;
