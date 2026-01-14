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
  authMiddleware.authorize(Role.LECTURER),
  performanceController.getLecturerPerformance.bind(performanceController)
);

// Admin view: All lecturers performance
router.get(
  '/admin/all-lecturers',
  authMiddleware.authorize(Role.ADMIN),
  performanceController.getAllLecturersPerformance.bind(performanceController)
);

export default router;
