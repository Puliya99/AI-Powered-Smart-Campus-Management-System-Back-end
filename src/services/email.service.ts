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
   * Send account creation email with login details
   */
  async sendAccountCreationEmail(email: string, firstName: string, username: string, passwordText: string) {
    const loginUrl = `${env.FRONTEND_URL}/login`;

    const mailOptions = {
      from: {
        name: 'Smart Campus',
        address: env.EMAIL_FROM || env.SMTP_USER!,
      },
      to: email,
      subject: 'Your Smart Campus Account Details',
      html: this.getAccountCreationEmailTemplate(firstName, username, passwordText, loginUrl),
      text: `Hello ${firstName}, your Smart Campus account has been created.\n\nLogin Details:\nURL: ${loginUrl}\nUsername: ${username}\nPassword: ${passwordText}\n\nPlease change your password after logging in.`,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Account creation email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send account creation email:', error);
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
   * Account Creation Email Template
   */
  private getAccountCreationEmailTemplate(firstName: string, username: string, passwordText: string, loginUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Created</title>
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
            text-align: center;
          }
          .credentials {
            background-color: #F3F4F6;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .credential-item {
            margin-bottom: 10px;
          }
          .label {
            font-weight: bold;
            color: #6B7280;
            display: block;
            font-size: 12px;
            text-transform: uppercase;
          }
          .value {
            font-family: monospace;
            font-size: 16px;
            color: #1F2937;
          }
          .button-container {
            text-align: center;
            margin-top: 30px;
          }
          .button {
            background-color: #4F46E5;
            color: white !important;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            display: inline-block;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #6B7280;
            font-size: 14px;
          }
          .warning {
            color: #B91C1C;
            font-size: 12px;
            margin-top: 20px;
            border-top: 1px solid #F3F4F6;
            padding-top: 15px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🎓 Smart Campus</div>
          </div>
          
          <div class="content">
            <h1>Welcome to Smart Campus</h1>
            
            <p>Hello ${firstName},</p>
            
            <p>Your account has been successfully created. You can now log in to the system using the credentials below:</p>
            
            <div class="credentials">
              <div class="credential-item">
                <span class="label">System URL</span>
                <span class="value">${loginUrl}</span>
              </div>
              <div class="credential-item">
                <span class="label">Username</span>
                <span class="value">${username}</span>
              </div>
              <div class="credential-item">
                <span class="label">Temporary Password</span>
                <span class="value">${passwordText}</span>
              </div>
            </div>
            
            <div class="button-container">
              <a href="${loginUrl}" class="button">Log In Now</a>
            </div>
            
            <div class="warning">
              <strong>Security Notice:</strong> For your security, please change your password immediately after your first login.
            </div>
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
  /**
   * Send a general notification email
   */
  async sendNotificationEmail(email: string, title: string, message: string, link?: string, firstName?: string) {
    // Skip if SMTP is not configured
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
      return { success: false, reason: 'SMTP not configured' };
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const readUrl = link ? `${frontendUrl}${link}` : `${frontendUrl}/notifications`;

    const mailOptions = {
      from: {
        name: 'Smart Campus',
        address: env.EMAIL_FROM || env.SMTP_USER!,
      },
      to: email,
      subject: `New Notification: ${title}`,
      html: this.getNotificationEmailTemplate(title, message, readUrl, firstName),
      text: `Hello${firstName ? ` ${firstName}` : ''},\n\nYou have received a new notification on Smart Campus.\n\n${title}\n\n${message}\n\nPlease log in to read this notification:\n${readUrl}\n\n© ${new Date().getFullYear()} Smart Campus. This is an automated email, please do not reply.`,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send notification email:', error);
      return { success: false };
    }
  }

  /**
   * Notification Email Template
   */
  private getNotificationEmailTemplate(title: string, message: string, readUrl: string, firstName?: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Notification: ${title}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .container { background-color: #f9f9f9; border-radius: 10px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 32px; font-weight: bold; color: #4F46E5; margin-bottom: 10px; }
          .content { background-color: white; padding: 30px; border-radius: 8px; }
          h1 { color: #1F2937; margin-top: 0; font-size: 22px; }
          .notification-box {
            background-color: #EEF2FF;
            border-left: 4px solid #4F46E5;
            border-radius: 6px;
            padding: 16px 20px;
            margin: 20px 0;
          }
          .notification-title { font-weight: 700; color: #1F2937; font-size: 15px; margin-bottom: 6px; }
          .notification-message { color: #374151; font-size: 14px; }
          .button-container { text-align: center; margin-top: 28px; }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #4F46E5, #7C3AED);
            color: white !important;
            padding: 14px 36px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 700;
            font-size: 15px;
            letter-spacing: 0.3px;
          }
          .footer { text-align: center; margin-top: 30px; color: #6B7280; font-size: 13px; }
          .divider { border-top: 1px solid #E5E7EB; margin: 24px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🎓 Smart Campus</div>
          </div>
          <div class="content">
            <h1>You have a new notification</h1>
            <p>Hello${firstName ? ` <strong>${firstName}</strong>` : ''},</p>
            <p>You have received a new notification on Smart Campus. Please log in to read it.</p>

            <div class="notification-box">
              <div class="notification-title">${title}</div>
              <div class="notification-message">${message}</div>
            </div>

            <div class="button-container">
              <a href="${readUrl}" class="button">Read Notification</a>
            </div>

            <div class="divider"></div>
            <p style="color:#6B7280; font-size:13px;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${readUrl}" style="color:#4F46E5; word-break:break-all;">${readUrl}</a>
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
}

export default new EmailService();
