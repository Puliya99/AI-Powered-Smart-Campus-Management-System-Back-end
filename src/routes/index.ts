import { Router } from 'express';
import authRoutes from './auth.routes';
import passwordResetRoutes from './password-reset.routes';

// Import other route modules here as you create them
// import studentRoutes from './student.routes';
// import lecturerRoutes from './lecturer.routes';

const router = Router();

// Register routes
router.use('/auth', authRoutes);
router.use('/password', passwordResetRoutes);
// router.use('/students', studentRoutes);
// router.use('/lecturers', lecturerRoutes);

// Default route
router.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Smart Campus API v1.0',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: {
        register: 'POST /api/v1/auth/register',
        login: 'POST /api/v1/auth/login',
        me: 'GET /api/v1/auth/me',
        changePassword: 'POST /api/v1/auth/change-password',
        logout: 'POST /api/v1/auth/logout',
      },
      password: {
        forgot: 'POST /api/v1/password/forgot-password',
        verify: 'GET /api/v1/password/verify-token/:token',
        reset: 'POST /api/v1/password/reset-password',
      },
      // Add more as you build them
    },
  });
});

export default router;
