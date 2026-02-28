import { Router } from 'express';
import notificationController from '../controllers/notification.controller';
import authMiddleware from '../middleware/auth.middleware';
import { Role } from '../enums/Role.enum';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate.bind(authMiddleware));

// Get current user's notifications
router.get('/my-notifications', notificationController.getMyNotifications.bind(notificationController));

// Get unread count
router.get('/unread-count', notificationController.getUnreadCount.bind(notificationController));

// Mark notification as read
router.patch('/:id/read', notificationController.markAsRead.bind(notificationController));

// Mark all as read
router.patch('/read-all', notificationController.markAllAsRead.bind(notificationController));

// Delete notification
router.delete('/:id', notificationController.deleteNotification.bind(notificationController));

// Send notification (Admin and Staff only)
router.post(
  '/send',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  notificationController.sendNotification.bind(notificationController)
);

export default router;
