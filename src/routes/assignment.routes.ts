import { Router } from 'express';
import assignmentController from '../controllers/assignment.controller';
import authMiddleware from '../middleware/auth.middleware';
import { Role } from '../enums/Role.enum';
import { uploadSingle } from '../middleware/upload.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate.bind(authMiddleware));

// Get assignments by module
router.get('/module/:moduleId', assignmentController.getAssignmentsByModule.bind(assignmentController));

// Get assignment by ID
router.get('/:id', assignmentController.getAssignmentById.bind(assignmentController));

// Create assignment (Lecturer only)
router.post(
  '/',
  authMiddleware.authorize(Role.LECTURER),
  uploadSingle('file'),
  assignmentController.createAssignment.bind(assignmentController)
);

// Update assignment (Lecturer and Admin)
router.put(
  '/:id',
  authMiddleware.authorize(Role.LECTURER, Role.ADMIN),
  uploadSingle('file'),
  assignmentController.updateAssignment.bind(assignmentController)
);

// Delete assignment (Lecturer and Admin)
router.delete(
  '/:id',
  authMiddleware.authorize(Role.LECTURER, Role.ADMIN),
  assignmentController.deleteAssignment.bind(assignmentController)
);

// Submit assignment (Student only)
router.post(
  '/:assignmentId/submit',
  authMiddleware.authorize(Role.STUDENT),
  uploadSingle('file'),
  assignmentController.submitAssignment.bind(assignmentController)
);

// Get submissions for an assignment (Lecturer only)
router.get(
  '/:assignmentId/submissions',
  authMiddleware.authorize(Role.LECTURER, Role.ADMIN),
  assignmentController.getSubmissionsByAssignment.bind(assignmentController)
);

// Mark submission (Lecturer only)
router.put(
  '/submissions/:id/mark',
  authMiddleware.authorize(Role.LECTURER, Role.ADMIN),
  assignmentController.markSubmission.bind(assignmentController)
);

// Download submission (Lecturer, Student of that submission, and Admin)
router.get(
  '/submissions/:id/download',
  assignmentController.downloadSubmission.bind(assignmentController)
);

export default router;