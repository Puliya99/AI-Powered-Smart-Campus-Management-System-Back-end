import nodemailer from 'nodemailer';
import { env } from '../config/env';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Create transporter with SMTP configuration
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465, // true for 465, false for other ports
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
    });

    // Verify transporter configuration
    this.verifyConnection();
  }

  private async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log('✅ Email service is ready to send emails');
    } catch (error) {
      console.error('❌ Email service configuration error:', error);
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, resetToken: string) {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

    const mailOptions = {
      from: {
        name: 'Smart Campus',
        address: env.EMAIL_FROM || env.SMTP_USER!,
      },
      to: email,
      subject: 'Password Reset Request',
      html: this.getPasswordResetEmailTemplate(resetUrl),
      text: `You requested a password reset. Click this link to reset your password: ${resetUrl}. This link will expire in 1 hour.`,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Password reset email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  /**
   * Send welcome email to new users
   */
  async sendWelcomeEmail(email: string, firstName: string) {
    const mailOptions = {
      from: {
        name: 'Smart Campus',
        address: env.EMAIL_FROM || env.SMTP_USER!,
      },
      to: email,
      subject: 'Welcome to Smart Campus!',
      html: this.getWelcomeEmailTemplate(firstName),
      text: `Welcome to Smart Campus, ${firstName}! Your account has been successfully created.`,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Welcome email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send welcome email:', error);
      // Don't throw error for welcome email to avoid blocking registration
      return { success: false };
    }
  }

  /**
   * Send password changed confirmation email
   */
  async sendPasswordChangedEmail(email: string, firstName: string) {
    const mailOptions = {
      from: {
        name: 'Smart Campus',
        address: env.EMAIL_FROM || env.SMTP_USER!,
      },
      to: email,
      subject: 'Password Changed Successfully',
      html: this.getPasswordChangedEmailTemplate(firstName),
      text: `Hello ${firstName}, your password has been changed successfully. If you didn't make this change, please contact support immediately.`,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Password changed email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send password changed email:', error);
      return { success: false };
    }
  }

  /**
   * Password Reset Email Template
   */
  private getPasswordResetEmailTemplate(resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background-color: #f9f9f9;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 32px;
            font-weight: bold;
            color: #4F46E5;
            margin-bottom: 10px;
          }
          .content {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
          }
          h1 {
            color: #1F2937;
            margin-top: 0;
            font-size: 24px;
          }
          .button {
            display: inline-block;
            padding: 14px 32px;
            background: linear-gradient(135deg, #4F46E5, #7C3AED);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            margin: 20px 0;
            font-weight: 600;
            text-align: center;
          }
          .button:hover {
            opacity: 0.9;
          }
          .warning {
            background-color: #FEF3C7;
            border-left: 4px solid #F59E0B;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #6B7280;
            font-size: 14px;
          }
          .divider {
            border-top: 1px solid #E5E7EB;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🎓 Smart Campus</div>
          </div>
          
          <div class="content">
            <h1>Password Reset Request</h1>
            
            <p>Hello,</p>
            
            <p>We received a request to reset your password for your Smart Campus account. Click the button below to reset your password:</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            
            <div class="warning">
              <strong>⚠️ Important:</strong> This link will expire in <strong>1 hour</strong> for security reasons.
            </div>
            
            <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
            
            <div class="divider"></div>
            
            <p style="color: #6B7280; font-size: 14px;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: #4F46E5; word-break: break-all;">${resetUrl}</a>
            </p>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} Smart Campus. All rights reserved.</p>
            <p>This is an automated email, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Welcome Email Template
   */
  private getWelcomeEmailTemplate(firstName: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Smart Campus</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background-color: #f9f9f9;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 32px;
            font-weight: bold;
            color: #4F46E5;
            margin-bottom: 10px;
          }
          .content {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
          }
          h1 {
            color: #1F2937;
            margin-top: 0;
            font-size: 24px;
          }
          .feature-list {
            list-style: none;
            padding: 0;
          }
          .feature-list li {
            padding: 10px 0;
            border-bottom: 1px solid #E5E7EB;
          }
          .feature-list li:last-child {
            border-bottom: none;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #6B7280;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🎓 Smart Campus</div>
          </div>
          
          <div class="content">
            <h1>Welcome to Smart Campus, ${firstName}! 🎉</h1>
            
            <p>Your account has been successfully created. We're excited to have you on board!</p>
            
            <p>With Smart Campus, you can:</p>
            
            <ul class="feature-list">
              <li>✅ Track your attendance and academic progress</li>
              <li>📚 Access course materials and assignments</li>
              <li>💳 Manage payments and view payment history</li>
              <li>📊 View detailed analytics and insights</li>
              <li>📱 Stay updated with notifications</li>
            </ul>
            
            <p>If you have any questions or need assistance, feel free to reach out to our support team.</p>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} Smart Campus. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Password Changed Email Template
   */
  private getPasswordChangedEmailTemplate(firstName: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Changed</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background-color: #f9f9f9;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 32px;
            font-weight: bold;
            color: #4F46E5;
            margin-bottom: 10px;
          }
          .content {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
          }
          h1 {
            color: #1F2937;
            margin-top: 0;
            font-size: 24px;
          }
          .alert {
            background-color: #DCFCE7;
            border-left: 4px solid #22C55E;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .warning {
            background-color: #FEF3C7;
            border-left: 4px solid #F59E0B;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #6B7280;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🎓 Smart Campus</div>
          </div>
          
          <div class="content">
            <h1>Password Changed Successfully</h1>
            
            <p>Hello ${firstName},</p>
            
            <div class="alert">
              <strong>✓ Success:</strong> Your password has been changed successfully.
            </div>
            
            <p>Your Smart Campus account password was recently changed. If you made this change, no further action is needed.</p>
            
            <div class="warning">
              <strong>⚠️ Security Alert:</strong> If you <strong>did not</strong> make this change, please contact our support team immediately to secure your account.
            </div>
            
            <p>For your security, we recommend:</p>
            <ul>
              <li>Using a strong, unique password</li>
              <li>Not sharing your password with anyone</li>
              <li>Changing your password regularly</li>
            </ul>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} Smart Campus. All rights reserved.</p>
            <p>This is an automated email, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export default new EmailService();
