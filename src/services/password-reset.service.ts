import { AppDataSource } from '../config/database';
import { User } from '../entities/User.entity';
import crypto from 'crypto';

interface PasswordResetToken {
  userId: string;
  token: string;
  expiresAt: Date;
}

// In-memory storage for reset tokens (use Redis in production)
const resetTokens = new Map<string, PasswordResetToken>();

export class PasswordResetService {
  private userRepository = AppDataSource.getRepository(User);

  // Request password reset
  async requestPasswordReset(email: string) {
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists
      return {
        message: 'If that email exists, we sent a password reset link',
      };
    }

    if (!user.isActive) {
      throw new Error('Account is inactive');
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Store token (expires in 1 hour)
    resetTokens.set(hashedToken, {
      userId: user.id,
      token: hashedToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    });

    // In production, send email with reset link
    // const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    // await sendEmail(user.email, resetUrl);

    console.log('Password reset token:', resetToken);
    console.log('User ID:', user.id);

    return {
      message: 'If that email exists, we sent a password reset link',
      resetToken, // Always include for now
    };
  }

  // Verify reset token
  async verifyResetToken(token: string) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const resetData = resetTokens.get(hashedToken);

    if (!resetData) {
      throw new Error('Invalid or expired reset token');
    }

    if (new Date() > resetData.expiresAt) {
      resetTokens.delete(hashedToken);
      throw new Error('Reset token has expired');
    }

    const user = await this.userRepository.findOne({
      where: { id: resetData.userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      valid: true,
      userId: user.id,
    };
  }

  // Reset password with token
  async resetPassword(token: string, newPassword: string) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const resetData = resetTokens.get(hashedToken);

    if (!resetData) {
      throw new Error('Invalid or expired reset token');
    }

    if (new Date() > resetData.expiresAt) {
      resetTokens.delete(hashedToken);
      throw new Error('Reset token has expired');
    }

    const user = await this.userRepository.findOne({
      where: { id: resetData.userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Update password
    user.password = newPassword; // Will be hashed by entity hook
    await this.userRepository.save(user);

    // Delete used token
    resetTokens.delete(hashedToken);

    return {
      message: 'Password reset successfully',
    };
  }

  // Cleanup expired tokens (call this periodically)
  cleanupExpiredTokens() {
    const now = new Date();
    for (const [token, data] of resetTokens.entries()) {
      if (now > data.expiresAt) {
        resetTokens.delete(token);
      }
    }
  }
}

export default new PasswordResetService();
