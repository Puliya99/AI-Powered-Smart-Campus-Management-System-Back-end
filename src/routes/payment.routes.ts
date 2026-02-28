import { Router } from 'express';
import paymentController from '../controllers/payment.controller';
import authMiddleware from '../middleware/auth.middleware';
import { Role } from '../enums/Role.enum';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate.bind(authMiddleware));

// Get all payments (Admin and Staff)
router.get(
  '/',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  paymentController.getAllPayments.bind(paymentController)
);

// Get payment statistics (Admin and Staff)
router.get(
  '/stats',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  paymentController.getPaymentStats.bind(paymentController)
);

// Get student payments (Student own payments)
router.get(
  '/student',
  authMiddleware.authorize(Role.STUDENT),
  paymentController.getStudentPayments.bind(paymentController)
);

// Get outstanding amount for a student and program
router.get(
  '/outstanding',
  authMiddleware.authorize(Role.ADMIN, Role.USER, Role.STUDENT),
  paymentController.getOutstanding.bind(paymentController)
);

// Get payment by ID (Admin, Staff, and own student)
router.get('/:id', paymentController.getPaymentById.bind(paymentController));

// Create payment (Admin and Staff)
router.post(
  '/',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  paymentController.createPayment.bind(paymentController)
);

// Update payment (Admin and Staff)
router.put(
  '/:id',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  paymentController.updatePayment.bind(paymentController)
);

// Delete payment (Admin only)
router.delete(
  '/:id',
  authMiddleware.authorize(Role.ADMIN),
  paymentController.deletePayment.bind(paymentController)
);

// Upload receipt (Student)
router.post(
  '/:paymentId/receipt',
  authMiddleware.authorize(Role.STUDENT),
  paymentController.uploadReceipt.bind(paymentController)
);

// Create student payment (Student)
router.post(
  '/student',
  authMiddleware.authorize(Role.STUDENT),
  paymentController.createStudentPayment.bind(paymentController)
);

// Approve or Reject payment (Admin and Staff)
router.post(
  '/:id/approve',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  paymentController.approvePayment.bind(paymentController)
);

export default router;
