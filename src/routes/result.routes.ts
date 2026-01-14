import { Router } from 'express';
import resultController from '../controllers/result.controller';
import authMiddleware from '../middleware/auth.middleware';
import { Role } from '../enums/Role.enum';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate.bind(authMiddleware));

// Get my own results (Student)
router.get('/my-results', authMiddleware.authorize(Role.STUDENT), resultController.getMyResults.bind(resultController));

// Get results for a module (Lecturer/Admin)
router.get('/module/:moduleId', authMiddleware.authorize(Role.LECTURER, Role.ADMIN), resultController.getResultsByModule.bind(resultController));

// Bulk upsert results (Lecturer/Admin)
router.post('/bulk', authMiddleware.authorize(Role.LECTURER, Role.ADMIN), resultController.bulkUpsertResults.bind(resultController));

// Upsert a single result
router.post('/', authMiddleware.authorize(Role.LECTURER, Role.ADMIN), resultController.upsertResult.bind(resultController));

// Delete a result
router.delete('/:id', authMiddleware.authorize(Role.LECTURER, Role.ADMIN), resultController.deleteResult.bind(resultController));

export default router;