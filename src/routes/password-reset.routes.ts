import { Router } from 'express';
import passwordResetController from '../controllers/password-reset.controller';

const router = Router();

// Request password reset
router.post('/forgot-password', passwordResetController.requestReset.bind(passwordResetController));

// Verify reset token
router.get(
  '/verify-token/:token',
  passwordResetController.verifyToken.bind(passwordResetController)
);

// Reset password
router.post('/reset-password', passwordResetController.resetPassword.bind(passwordResetController));

export default router;
