import { Router } from 'express';
import lecturerController from '../controllers/lecturer.controller';
import authMiddleware from '../middleware/auth.middleware';
import { Role } from '../enums/Role.enum';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate.bind(authMiddleware));

// Get all lecturers (Admin and Staff only)
router.get(
  '/',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  lecturerController.getAllLecturers.bind(lecturerController)
);

// Get lecturers dropdown (for forms)
router.get('/dropdown', lecturerController.getLecturersDropdown.bind(lecturerController));

// Get lecturer statistics (Admin only)
router.get(
  '/stats',
  authMiddleware.authorize(Role.ADMIN),
  lecturerController.getLecturerStats.bind(lecturerController)
);

// Get lecturer by ID
router.get('/:id', lecturerController.getLecturerById.bind(lecturerController));

// Create lecturer (Admin and Staff only)
router.post(
  '/',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  lecturerController.createLecturer.bind(lecturerController)
);

// Update lecturer (Admin and Staff only)
router.put(
  '/:id',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  lecturerController.updateLecturer.bind(lecturerController)
);

// Delete/deactivate lecturer (Admin only)
router.delete(
  '/:id',
  authMiddleware.authorize(Role.ADMIN),
  lecturerController.deleteLecturer.bind(lecturerController)
);

export default router;
