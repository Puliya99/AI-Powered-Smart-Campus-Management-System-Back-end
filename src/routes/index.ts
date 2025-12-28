import { Router } from 'express';

// Import route modules here when you create them
// import authRoutes from './auth.routes';
// import studentRoutes from './student.routes';
// import lecturerRoutes from './lecturer.routes';
// import programRoutes from './program.routes';
// import moduleRoutes from './module.routes';
// import batchRoutes from './batch.routes';
// import enrollmentRoutes from './enrollment.routes';
// import scheduleRoutes from './schedule.routes';
// import attendanceRoutes from './attendance.routes';
// import paymentRoutes from './payment.routes';
// import assignmentRoutes from './assignment.routes';
// import resultRoutes from './result.routes';
// import feedbackRoutes from './feedback.routes';
// import notificationRoutes from './notification.routes';
// import dashboardRoutes from './dashboard.routes';
// import aiRoutes from './ai.routes';

const router = Router();

// Register routes here when you create them
// router.use('/auth', authRoutes);
// router.use('/students', studentRoutes);
// router.use('/lecturers', lecturerRoutes);
// router.use('/programs', programRoutes);
// router.use('/modules', moduleRoutes);
// router.use('/batches', batchRoutes);
// router.use('/enrollments', enrollmentRoutes);
// router.use('/schedules', scheduleRoutes);
// router.use('/attendance', attendanceRoutes);
// router.use('/payments', paymentRoutes);
// router.use('/assignments', assignmentRoutes);
// router.use('/results', resultRoutes);
// router.use('/feedback', feedbackRoutes);
// router.use('/notifications', notificationRoutes);
// router.use('/dashboard', dashboardRoutes);
// router.use('/ai', aiRoutes);

// Default API route
router.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Smart Campus API v1.0',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/v1/auth',
      students: '/api/v1/students',
      lecturers: '/api/v1/lecturers',
      programs: '/api/v1/programs',
      modules: '/api/v1/modules',
      batches: '/api/v1/batches',
      enrollments: '/api/v1/enrollments',
      schedules: '/api/v1/schedules',
      attendance: '/api/v1/attendance',
      payments: '/api/v1/payments',
      assignments: '/api/v1/assignments',
      results: '/api/v1/results',
      feedback: '/api/v1/feedback',
      notifications: '/api/v1/notifications',
      dashboard: '/api/v1/dashboard',
      ai: '/api/v1/ai',
    },
  });
});

export default router;
