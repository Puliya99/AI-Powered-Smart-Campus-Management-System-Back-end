import { Router } from 'express';
import centerController from '../controllers/center.controller';
import authMiddleware from '../middleware/auth.middleware';
import { Role } from '../enums/Role.enum';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate.bind(authMiddleware));

// Get all centers (Admin only)
router.get(
  '/',
  authMiddleware.authorize(Role.ADMIN),
  centerController.getAllCenters.bind(centerController)
);

// Get centers dropdown (for forms - all authenticated users)
router.get('/dropdown', centerController.getCentersDropdown.bind(centerController));

// Get center statistics (Admin only)
router.get(
  '/stats',
  authMiddleware.authorize(Role.ADMIN),
  centerController.getCenterStats.bind(centerController)
);

// Get center by ID
router.get('/:id', centerController.getCenterById.bind(centerController));

// Create center (Admin only)
router.post(
  '/',
  authMiddleware.authorize(Role.ADMIN),
  centerController.createCenter.bind(centerController)
);

// Update center (Admin only)
router.put(
  '/:id',
  authMiddleware.authorize(Role.ADMIN),
  centerController.updateCenter.bind(centerController)
);

// Delete center (Admin only)
router.delete(
  '/:id',
  authMiddleware.authorize(Role.ADMIN),
  centerController.deleteCenter.bind(centerController)
);

export default router;
