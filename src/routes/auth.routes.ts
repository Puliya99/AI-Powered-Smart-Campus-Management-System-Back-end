import { Router } from 'express';
import authController from '../controllers/auth.controller';
import authMiddleware from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.post('/register', authController.register.bind(authController));
router.post('/login', authController.login.bind(authController));

// Protected routes
router.get(
  '/me',
  authMiddleware.authenticate.bind(authMiddleware),
  authController.getCurrentUser.bind(authController)
);

router.post(
  '/change-password',
  authMiddleware.authenticate.bind(authMiddleware),
  authController.changePassword.bind(authController)
);

router.post(
  '/logout',
  authMiddleware.authenticate.bind(authMiddleware),
  authController.logout.bind(authController)
);

export default router;
