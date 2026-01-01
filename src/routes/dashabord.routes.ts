import { Router } from 'express';
import dashboardController from '../controllers/dashboard.controller';
import authMiddleware from '../middleware/auth.middleware';

const router = Router();

// All dashboard routes require authentication
router.use(authMiddleware.authenticate.bind(authMiddleware));

// Generic dashboard route (returns data based on user role)
router.get('/', dashboardController.getDashboard.bind(dashboardController));

// Role-specific dashboard routes
router.get(
  '/admin',
  authMiddleware.authorize('ADMIN' as any),
  dashboardController.getAdminDashboard.bind(dashboardController)
);

router.get(
  '/student',
  authMiddleware.authorize('STUDENT' as any),
  dashboardController.getStudentDashboard.bind(dashboardController)
);

router.get(
  '/lecturer',
  authMiddleware.authorize('LECTURER' as any),
  dashboardController.getLecturerDashboard.bind(dashboardController)
);

router.get(
  '/staff',
  authMiddleware.authorize('USER' as any),
  dashboardController.getStaffDashboard.bind(dashboardController)
);

export default router;
