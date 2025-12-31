import { Request, Response } from 'express';
import passwordResetService from '../services/password-reset.service';
import { ForgotPasswordDto, ResetPasswordDto } from '../dto/auth.dto';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

export class PasswordResetController {
  // Request password reset
  async requestReset(req: Request, res: Response) {
    try {
      const forgotPasswordDto = plainToClass(ForgotPasswordDto, req.body);
      const errors = await validate(forgotPasswordDto);

      if (errors.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.map(err => ({
            field: err.property,
            messages: Object.values(err.constraints || {}),
          })),
        });
      }

      const result = await passwordResetService.requestPasswordReset(forgotPasswordDto.email);

      res.json({
        status: 'success',
        message: result.message,
        ...((result as any).resetToken && {
          data: { resetToken: (result as any).resetToken },
        }),
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to process request',
      });
    }
  }

  // Verify reset token
  async verifyToken(req: Request, res: Response) {
    try {
      const { token } = req.params;

      if (!token) {
        return res.status(400).json({
          status: 'error',
          message: 'Token is required',
        });
      }

      const result = await passwordResetService.verifyResetToken(token);

      res.json({
        status: 'success',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Invalid or expired token',
      });
    }
  }

  // Reset password
  async resetPassword(req: Request, res: Response) {
    try {
      const resetPasswordDto = plainToClass(ResetPasswordDto, req.body);
      const errors = await validate(resetPasswordDto);

      if (errors.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.map(err => ({
            field: err.property,
            messages: Object.values(err.constraints || {}),
          })),
        });
      }

      const result = await passwordResetService.resetPassword(
        resetPasswordDto.token,
        resetPasswordDto.newPassword
      );

      res.json({
        status: 'success',
        message: result.message,
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to reset password',
      });
    }
  }
}

export default new PasswordResetController();
