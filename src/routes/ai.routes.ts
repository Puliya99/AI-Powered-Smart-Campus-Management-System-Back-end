import { Router } from 'express';
import aiController from '../controllers/ai.controller';
import authMiddleware from '../middleware/auth.middleware';
import { Role } from '../enums/Role.enum';

const router = Router();

router.use(authMiddleware.authenticate.bind(authMiddleware));

router.post(
  '/predict-exam-risk',
  authMiddleware.authorize(Role.LECTURER, Role.ADMIN),
  aiController.predictExamRisk.bind(aiController)
);

router.post(
  '/train-model',
  authMiddleware.authorize(Role.ADMIN),
  aiController.trainModel.bind(aiController)
);

router.get(
  '/student-features',
  authMiddleware.authorize(Role.LECTURER, Role.ADMIN),
  aiController.getStudentFeatures.bind(aiController)
);

router.get(
  '/predictions/student/:studentId',
  authMiddleware.authorize(Role.LECTURER, Role.ADMIN, Role.STUDENT, Role.USER),
  aiController.getPredictionHistory.bind(aiController)
);

router.post(
  '/materials/:id/process',
  authMiddleware.authorize(Role.LECTURER, Role.ADMIN, Role.STUDENT),
  aiController.processMaterial.bind(aiController)
);

router.post(
  '/chat/ask',
  authMiddleware.authorize(Role.STUDENT, Role.LECTURER, Role.ADMIN, Role.USER),
  aiController.askQuestion.bind(aiController)
);

export default router;
