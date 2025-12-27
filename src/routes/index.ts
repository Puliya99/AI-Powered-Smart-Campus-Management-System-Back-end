import { Router } from 'express'
// Import route modules here
// import authRoutes from './auth.routes';
// import studentRoutes from './student.routes';

const router = Router()

// Register routes
// router.use('/auth', authRoutes);
// router.use('/students', studentRoutes);

// Default route
router.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Smart Campus API v1.0',
    endpoints: {
      health: '/health',
      auth: '/api/v1/auth',
      students: '/api/v1/students',
      lecturers: '/api/v1/lecturers',
      // Add more as you build them
    },
  })
})

export default router
