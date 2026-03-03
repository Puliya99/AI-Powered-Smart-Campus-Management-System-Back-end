import { Router } from 'express';
import resultController from '../controllers/result.controller';
import authMiddleware from '../middleware/auth.middleware';
import { Role } from '../enums/Role.enum';

const router = Router();

router.use(authMiddleware.authenticate.bind(authMiddleware));

// ── Student ───────────────────────────────────────────────────────────────────
router.get(
  '/my-results',
  authMiddleware.authorize(Role.STUDENT),
  resultController.getMyResults.bind(resultController),
);

// ── Graduation report (Admin / USER) ─────────────────────────────────────────
router.get(
  '/graduation-report',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  resultController.getGraduationReport.bind(resultController),
);

// ── Repeat exam enrollments ───────────────────────────────────────────────────
router.get(
  '/repeats',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  resultController.getRepeatEnrollments.bind(resultController),
);

router.post(
  '/repeats',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  resultController.createRepeatExamEnrollment.bind(resultController),
);

router.patch(
  '/repeats/:id',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  resultController.updateRepeatEnrollment.bind(resultController),
);

router.post(
  '/repeats/notify-batch',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  resultController.notifyRepeatStudentsForBatch.bind(resultController),
);

// ── Module results (Lecturer / Admin / USER) ──────────────────────────────────
router.get(
  '/module/:moduleId',
  authMiddleware.authorize(Role.LECTURER, Role.ADMIN, Role.USER),
  resultController.getResultsByModule.bind(resultController),
);

// ── Bulk upsert results ───────────────────────────────────────────────────────
router.post(
  '/bulk',
  authMiddleware.authorize(Role.LECTURER, Role.ADMIN, Role.USER),
  resultController.bulkUpsertResults.bind(resultController),
);

// ── Single upsert ─────────────────────────────────────────────────────────────
router.post(
  '/',
  authMiddleware.authorize(Role.LECTURER, Role.ADMIN, Role.USER),
  resultController.upsertResult.bind(resultController),
);

// ── Delete result ─────────────────────────────────────────────────────────────
router.delete(
  '/:id',
  authMiddleware.authorize(Role.LECTURER, Role.ADMIN, Role.USER),
  resultController.deleteResult.bind(resultController),
);

export default router;
