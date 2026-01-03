import { Router } from 'express';
import authRoutes from './auth.routes';
import passwordResetRoutes from './password-reset.routes';
import dashboardRoutes from './dashabord.routes';
import studentRoutes from './student.routes';
import programRoutes from './program.routes';
import moduleRoutes from './module.routes';
import lecturerRoutes from './lecturer.routes';

const router = Router();

// Register routes
router.use('/auth', authRoutes);
router.use('/password', passwordResetRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/students', studentRoutes);
router.use('/programs', programRoutes);
router.use('/modules', moduleRoutes);
router.use('/lecturers', lecturerRoutes);

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
      dashboard: {
        get: 'GET /api/v1/dashboard',
        admin: 'GET /api/v1/dashboard/admin',
        student: 'GET /api/v1/dashboard/student',
        lecturer: 'GET /api/v1/dashboard/lecturer',
        staff: 'GET /api/v1/dashboard/staff',
      },
      students: {
        list: 'GET /api/v1/students',
        stats: 'GET /api/v1/students/stats',
        create: 'POST /api/v1/students',
        get: 'GET /api/v1/students/:id',
        update: 'PUT /api/v1/students/:id',
        delete: 'DELETE /api/v1/students/:id',
      },
      programs: {
        list: 'GET /api/v1/programs',
        dropdown: 'GET /api/v1/programs/dropdown',
        stats: 'GET /api/v1/programs/stats',
        create: 'POST /api/v1/programs',
        get: 'GET /api/v1/programs/:id',
        update: 'PUT /api/v1/programs/:id',
        delete: 'DELETE /api/v1/programs/:id',
      },
      modules: {
        list: 'GET /api/v1/modules',
        dropdown: 'GET /api/v1/modules/dropdown',
        stats: 'GET /api/v1/modules/stats',
        create: 'POST /api/v1/modules',
        get: 'GET /api/v1/modules/:id',
        update: 'PUT /api/v1/modules/:id',
        delete: 'DELETE /api/v1/modules/:id',
      },
      lecturers: {
        list: 'GET /api/v1/lecturers',
        dropdown: 'GET /api/v1/lecturers/dropdown',
        stats: 'GET /api/v1/lecturers/stats',
        create: 'POST /api/v1/lecturers',
        get: 'GET /api/v1/lecturers/:id',
        update: 'PUT /api/v1/lecturers/:id',
        delete: 'DELETE /api/v1/lecturers/:id',
      },
    },
  });
});

export default router;
