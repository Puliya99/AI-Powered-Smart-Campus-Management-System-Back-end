import { AppDataSource } from '../config/database';
import { User } from '../entities/User.entity';
import crypto from 'crypto';
import emailService from './email.service';

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
      // Don't reveal if user exists for security
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

    // Send password reset email
    try {
      await emailService.sendPasswordResetEmail(user.email, resetToken);
      console.log('✅ Password reset email sent to:', user.email);
    } catch (error) {
      console.error('❌ Failed to send password reset email:', error);
      // Continue even if email fails - don't expose this to user
    }

    // Always log token for testing/debugging
    console.log('🔑 Password reset token:', resetToken);
    console.log('👤 User ID:', user.id);

    return {
      message: 'If that email exists, we sent a password reset link',
      resetToken, // Always include token in response
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

    // Send confirmation email
    try {
      await emailService.sendPasswordChangedEmail(user.email, user.firstName);
      console.log('✅ Password changed confirmation email sent');
    } catch (error) {
      console.error('❌ Failed to send password changed email:', error);
      // Don't fail the request if email fails
    }

    return {
      message: 'Password reset successfully',
    };
  }

  // Cleanup expired tokens (call this periodically)
  cleanupExpiredTokens() {
    const now = new Date();
    let cleaned = 0;

    for (const [token, data] of resetTokens.entries()) {
      if (now > data.expiresAt) {
        resetTokens.delete(token);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired password reset tokens`);
    }

    return cleaned;
  }
}

export default new PasswordResetService();
