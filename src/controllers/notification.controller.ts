import { Request, Response } from 'express';
import notificationService from '../services/notification.service';
import { NotificationType } from '../enums/NotificationType.enum';

export class NotificationController {
  // Get current user's notifications
  async getMyNotifications(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const { page, limit, isRead } = req.query;

      const result = await notificationService.getUserNotifications(userId, {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        isRead: isRead !== undefined ? isRead === 'true' : undefined,
      });

      res.json({
        status: 'success',
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch notifications',
      });
    }
  }

  // Get unread count
  async getUnreadCount(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const count = await notificationService.getUnreadCount(userId);

      res.json({
        status: 'success',
        data: { count },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch unread count',
      });
    }
  }

  // Mark a notification as read
  async markAsRead(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const { id } = req.params;

      await notificationService.markAsRead(id, userId);

      res.json({
        status: 'success',
        message: 'Notification marked as read',
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to mark notification as read',
      });
    }
  }

  // Mark all notifications as read
  async markAllAsRead(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;

      await notificationService.markAllAsRead(userId);

      res.json({
        status: 'success',
        message: 'All notifications marked as read',
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to mark notifications as read',
      });
    }
  }

  // Delete a notification
  async deleteNotification(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const { id } = req.params;

      await notificationService.deleteNotification(id, userId);

      res.json({
        status: 'success',
        message: 'Notification deleted successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to delete notification',
      });
    }
  }

  // Admin/Staff send notification to users
  async sendNotification(req: Request, res: Response) {
    try {
      const { userIds, title, message, type, link, sendToAll, sendEmail } = req.body;

      if (sendToAll) {
        await notificationService.notifyAllUsers({
          title,
          message,
          type: type || NotificationType.GENERAL,
          link,
          sendEmail: sendEmail === true,
        });
      } else {
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
          return res.status(400).json({
            status: 'error',
            message: 'User IDs are required and must be an array',
          });
        }

        await notificationService.createNotifications({
          userIds,
          title,
          message,
          type: type || NotificationType.GENERAL,
          link,
          sendEmail: sendEmail === true,
        });
      }

      res.status(201).json({
        status: 'success',
        message: 'Notifications sent successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to send notifications',
      });
    }
  }
}

export default new NotificationController();
