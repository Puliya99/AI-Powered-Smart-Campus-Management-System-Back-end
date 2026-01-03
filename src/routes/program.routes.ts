import { Router } from 'express';
import programController from '../controllers/program.controller';
import authMiddleware from '../middleware/auth.middleware';
import { Role } from '../enums/Role.enum';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate.bind(authMiddleware));

// Get all programs (All authenticated users can view)
router.get('/', programController.getAllPrograms.bind(programController));

// Get programs dropdown (for forms)
router.get('/dropdown', programController.getProgramsDropdown.bind(programController));

// Get program statistics (Admin only)
router.get(
  '/stats',
  authMiddleware.authorize(Role.ADMIN),
  programController.getProgramStats.bind(programController)
);

// Get program by ID
router.get('/:id', programController.getProgramById.bind(programController));

// Create program (Admin only)
router.post(
  '/',
  authMiddleware.authorize(Role.ADMIN),
  programController.createProgram.bind(programController)
);

// Update program (Admin only)
router.put(
  '/:id',
  authMiddleware.authorize(Role.ADMIN),
  programController.updateProgram.bind(programController)
);

// Delete program (Admin only)
router.delete(
  '/:id',
  authMiddleware.authorize(Role.ADMIN),
  programController.deleteProgram.bind(programController)
);

export default router;
