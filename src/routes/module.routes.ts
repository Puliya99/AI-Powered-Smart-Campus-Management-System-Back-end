import { Router } from 'express';
import moduleController from '../controllers/module.controller';
import authMiddleware from '../middleware/auth.middleware';
import { Role } from '../enums/Role.enum';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate.bind(authMiddleware));

// Get all modules (All authenticated users can view)
router.get('/', moduleController.getAllModules.bind(moduleController));

// Get modules dropdown (for forms)
router.get('/dropdown', moduleController.getModulesDropdown.bind(moduleController));

// Get module statistics (Admin, Lecturers, and Staff)
router.get(
  '/stats',
  authMiddleware.authorize(Role.ADMIN, Role.LECTURER, Role.USER),
  moduleController.getModuleStats.bind(moduleController)
);

// Get module by ID
router.get('/:id', moduleController.getModuleById.bind(moduleController));

// Create module (Admin and Staff)
router.post(
  '/',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  moduleController.createModule.bind(moduleController)
);

// Update module (Admin and Staff)
router.put(
  '/:id',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  moduleController.updateModule.bind(moduleController)
);

// Delete module (Admin only)
router.delete(
  '/:id',
  authMiddleware.authorize(Role.ADMIN),
  moduleController.deleteModule.bind(moduleController)
);

export default router;
