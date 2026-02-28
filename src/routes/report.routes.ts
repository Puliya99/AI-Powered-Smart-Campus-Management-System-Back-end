import { Router } from 'express';
import reportController from '../controllers/report.controller';
import authMiddleware from '../middleware/auth.middleware';
import { Role } from '../enums/Role.enum';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate.bind(authMiddleware));

// Get enrollment report (Admin and Staff)
router.get(
  '/enrollment',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  reportController.getEnrollmentReport.bind(reportController)
);

// Get payment report (Admin and Staff)
router.get(
  '/payment',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  reportController.getPaymentReport.bind(reportController)
);

// Get attendance report (Admin and Staff)
router.get(
  '/attendance',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  reportController.getAttendanceReport.bind(reportController)
);

// Get report stats (Admin and Staff)
router.get(
  '/stats',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  reportController.getReportStats.bind(reportController)
);

export default router;
