import { Router } from 'express';
import lectureNoteController from '../controllers/lectureNote.controller';
import authMiddleware from '../middleware/auth.middleware';
import { Role } from '../enums/Role.enum';
import { uploadSingle } from '../middleware/upload.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate.bind(authMiddleware));

// Get materials by module
router.get('/module/:moduleId', lectureNoteController.getMaterialsByModule.bind(lectureNoteController));

// Create material (Lecturers only)
router.post(
  '/',
  authMiddleware.authorize(Role.LECTURER),
  uploadSingle('file'),
  lectureNoteController.createMaterial.bind(lectureNoteController)
);

// Delete material (Lecturers and Admin)
router.delete(
  '/:id',
  authMiddleware.authorize(Role.LECTURER, Role.ADMIN),
  lectureNoteController.deleteMaterial.bind(lectureNoteController)
);

export default router;
