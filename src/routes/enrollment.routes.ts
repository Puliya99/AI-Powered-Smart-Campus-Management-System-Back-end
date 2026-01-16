import { Router } from 'express';
import { EnrollmentController } from '../controllers/enrollment.controller';
import authMiddleware from '../middleware/auth.middleware';
import { Role } from '../enums/Role.enum';

const router = Router();
const enrollmentController = new EnrollmentController();

// All routes require authentication
router.use(authMiddleware.authenticate.bind(authMiddleware));

// Get all enrollments (Admin and Staff only)
router.get(
  '/',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  enrollmentController.getAllEnrollments.bind(enrollmentController)
);

// Get enrollment by ID (Admin and Staff only)
router.get(
  '/:id',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  enrollmentController.getEnrollmentById.bind(enrollmentController)
);

// Create enrollment (Admin and Staff only)
router.post(
  '/',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  enrollmentController.createEnrollment.bind(enrollmentController)
);

// Update enrollment (Admin and Staff only)
router.put(
  '/:id',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  enrollmentController.updateEnrollment.bind(enrollmentController)
);

// Delete enrollment (Admin only)
router.delete(
  '/:id',
  authMiddleware.authorize(Role.ADMIN),
  enrollmentController.deleteEnrollment.bind(enrollmentController)
);

export default router;
