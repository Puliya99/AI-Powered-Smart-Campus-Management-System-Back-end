import { Router } from 'express';
import faceController from '../controllers/face.controller';
import authMiddleware from '../middleware/auth.middleware';
import { Role } from '../enums/Role.enum';

const router = Router();

router.use(authMiddleware.authenticate.bind(authMiddleware));

router.post(
  '/enroll',
  authMiddleware.authorize(Role.STUDENT),
  faceController.enrollFace.bind(faceController)
);

router.post(
  '/verify',
  authMiddleware.authorize(Role.STUDENT),
  faceController.verifyFace.bind(faceController)
);

router.post(
  '/liveness-check',
  authMiddleware.authorize(Role.STUDENT),
  faceController.livenessCheck.bind(faceController)
);

router.get(
  '/check/:studentId',
  authMiddleware.authorize(Role.STUDENT, Role.LECTURER, Role.ADMIN),
  faceController.checkEnrollment.bind(faceController)
);

export default router;
