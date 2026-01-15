import { Router } from 'express';
import scheduleController from '../controllers/schedule.controller';
import authMiddleware from '../middleware/auth.middleware';
import { Role } from '../enums/Role.enum';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate.bind(authMiddleware));

// Get schedule statistics
router.get(
  '/stats',
  authMiddleware.authorize(Role.ADMIN, Role.LECTURER),
  scheduleController.getScheduleStats.bind(scheduleController)
);

// Get schedules by date
router.get('/date/:date', scheduleController.getSchedulesByDate.bind(scheduleController));

// Get lecturer schedule
router.get(
  '/lecturer/:lecturerId',
  scheduleController.getLecturerSchedule.bind(scheduleController)
);

// Get all schedules
router.get('/', authMiddleware.authorize(Role.ADMIN, Role.LECTURER, Role.USER), scheduleController.getAllSchedules.bind(scheduleController));

// Get schedule by ID
router.get('/:id', scheduleController.getScheduleById.bind(scheduleController));

// Create schedule (Admin and Staff)
router.post(
  '/',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  scheduleController.createSchedule.bind(scheduleController)
);

// Update schedule (Admin and Staff)
router.put(
  '/:id',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  scheduleController.updateSchedule.bind(scheduleController)
);

// Delete schedule (Admin only)
router.delete(
  '/:id',
  authMiddleware.authorize(Role.ADMIN),
  scheduleController.deleteSchedule.bind(scheduleController)
);

export default router;
