import { AppDataSource } from '../config/database';
import { Notification } from '../entities/Notification.entity';
import { User } from '../entities/User.entity';
import { NotificationType } from '../enums/NotificationType.enum';
import emailService from './email.service';

export class NotificationService {
  private notificationRepository = AppDataSource.getRepository(Notification);
  private userRepository = AppDataSource.getRepository(User);

  // Get notifications for a specific user
  async getUserNotifications(userId: string, options: { page?: number; limit?: number; isRead?: boolean } = {}) {
    const { page = 1, limit = 20, isRead } = options;
    const skip = (page - 1) * limit;

    const queryBuilder = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (isRead !== undefined) {
      queryBuilder.andWhere('notification.isRead = :isRead', { isRead });
    }

    const [notifications, total] = await queryBuilder.getManyAndCount();

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // Create and send a notification to a specific user
  async createNotification(data: {
    userId: string;
    title: string;
    message: string;
    type: NotificationType;
    link?: string;
    sendEmail?: boolean;
  }) {
    const user = await this.userRepository.findOne({ where: { id: data.userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const notification = this.notificationRepository.create({
      user,
      title: data.title,
      message: data.message,
      type: data.type,
      link: data.link,
      isRead: false,
    });

    const savedNotification = await this.notificationRepository.save(notification);

    if (data.sendEmail) {
      try {
        await emailService.sendNotificationEmail(user.email, data.title, data.message, data.link);
      } catch (emailError) {
        console.error('Failed to send notification email:', emailError);
      }
    }

    return savedNotification;
  }

  // Create notifications for multiple users
  async createNotifications(data: {
    userIds: string[];
    title: string;
    message: string;
    type: NotificationType;
    link?: string;
    sendEmail?: boolean;
  }) {
    const notifications = data.userIds.map(userId => {
      return this.notificationRepository.create({
        user: { id: userId } as User,
        title: data.title,
        message: data.message,
        type: data.type,
        link: data.link,
        isRead: false,
      });
    });

    const savedNotifications = await this.notificationRepository.save(notifications);

    // Send emails if requested
    if (data.sendEmail) {
      try {
        const users = await this.userRepository.findByIds(data.userIds);
        const emailPromises = users.map(user => 
          emailService.sendNotificationEmail(user.email, data.title, data.message, data.link)
        );
        await Promise.all(emailPromises);
      } catch (emailError) {
        console.error('Failed to send notification emails:', emailError);
      }
    }

    return savedNotifications;
  }

  // Send notification to all users
  async notifyAllUsers(data: {
    title: string;
    message: string;
    type: NotificationType;
    link?: string;
    sendEmail?: boolean;
  }) {
    const users = await this.userRepository.find({ select: ['id', 'email'] });
    const userIds = users.map(user => user.id);

    if (userIds.length === 0) return [];

    return await this.createNotifications({
      userIds,
      ...data
    });
  }

  // Mark notification as read
  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, user: { id: userId } },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    notification.isRead = true;
    return await this.notificationRepository.save(notification);
  }

  // Mark all notifications as read for a user
  async markAllAsRead(userId: string) {
    await this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true })
      .where('userId = :userId', { userId })
      .andWhere('isRead = :isRead', { isRead: false })
      .execute();

    return { success: true };
  }

  // Delete a notification
  async deleteNotification(notificationId: string, userId: string) {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, user: { id: userId } },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    await this.notificationRepository.remove(notification);
    return { success: true };
  }

  // Get unread count
  async getUnreadCount(userId: string) {
    return await this.notificationRepository.count({
      where: { user: { id: userId }, isRead: false },
    });
  }
}

export default new NotificationService();
