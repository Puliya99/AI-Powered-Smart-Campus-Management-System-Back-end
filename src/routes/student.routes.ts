import { Router } from 'express';
import studentController from '../controllers/student.controller';
import authMiddleware from '../middleware/auth.middleware';
import { Role } from '../enums/Role.enum';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate.bind(authMiddleware));

// Get all students (Admin and Staff only)
router.get(
  '/',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  studentController.getAllStudents.bind(studentController)
);

// Get student statistics (Admin only)
router.get(
  '/stats',
  authMiddleware.authorize(Role.ADMIN),
  studentController.getStudentStats.bind(studentController)
);

// Get student by ID (Admin, Staff, and own student)
router.get('/:id', studentController.getStudentById.bind(studentController));

// Create student (Admin and Staff only)
router.post(
  '/',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  studentController.createStudent.bind(studentController)
);

// Update student (Admin and Staff only)
router.put(
  '/:id',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  studentController.updateStudent.bind(studentController)
);

// Delete/deactivate student (Admin only)
router.delete(
  '/:id',
  authMiddleware.authorize(Role.ADMIN),
  studentController.deleteStudent.bind(studentController)
);

export default router;
