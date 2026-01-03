import { Router } from 'express';
import batchController from '../controllers/batch.controller';
import authMiddleware from '../middleware/auth.middleware';
import { Role } from '../enums/Role.enum';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate.bind(authMiddleware));

// Get all batches (All authenticated users can view)
router.get('/', batchController.getAllBatches.bind(batchController));

// Get batches dropdown (for forms)
router.get('/dropdown', batchController.getBatchesDropdown.bind(batchController));

// Get batch statistics (Admin only)
router.get(
  '/stats',
  authMiddleware.authorize(Role.ADMIN),
  batchController.getBatchStats.bind(batchController)
);

// Get batch by ID
router.get('/:id', batchController.getBatchById.bind(batchController));

// Get batch enrollments
router.get('/:id/enrollments', batchController.getBatchEnrollments.bind(batchController));

// Create batch (Admin only)
router.post(
  '/',
  authMiddleware.authorize(Role.ADMIN),
  batchController.createBatch.bind(batchController)
);

// Update batch (Admin only)
router.put(
  '/:id',
  authMiddleware.authorize(Role.ADMIN),
  batchController.updateBatch.bind(batchController)
);

// Delete batch (Admin only)
router.delete(
  '/:id',
  authMiddleware.authorize(Role.ADMIN),
  batchController.deleteBatch.bind(batchController)
);

export default router;
