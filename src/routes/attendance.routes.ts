import { Router } from 'express';
import attendanceController from '../controllers/attendance.controller';
import authMiddleware from '../middleware/auth.middleware';
import { Role } from '../enums/Role.enum';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate.bind(authMiddleware));

// Get attendance statistics (Admin and Lecturers)
router.get(
  '/stats',
  authMiddleware.authorize(Role.ADMIN, Role.LECTURER),
  attendanceController.getAttendanceStats.bind(attendanceController)
);

// Get schedule attendance (Lecturers can view their schedules)
router.get(
  '/schedule/:scheduleId',
  attendanceController.getScheduleAttendance.bind(attendanceController)
);

// Get student attendance report
router.get(
  '/student/:studentId/report',
  attendanceController.getStudentAttendanceReport.bind(attendanceController)
);

// Get batch attendance summary
router.get(
  '/batch/:batchId/summary',
  attendanceController.getBatchAttendanceSummary.bind(attendanceController)
);

// Get all attendance records
router.get('/', attendanceController.getAllAttendance.bind(attendanceController));

// Get attendance by ID
router.get('/:id', attendanceController.getAttendanceById.bind(attendanceController));

// Mark attendance (Lecturers and Admin)
router.post(
  '/mark',
  authMiddleware.authorize(Role.ADMIN, Role.LECTURER),
  attendanceController.markAttendance.bind(attendanceController)
);

// Fingerprint scan endpoint (requires authentication; consider API key for devices)
router.post(
  '/scan',
  attendanceController.scanFingerprint.bind(attendanceController)
);

// Update attendance record (Lecturers and Admin)
router.put(
  '/:id',
  authMiddleware.authorize(Role.ADMIN, Role.LECTURER),
  attendanceController.updateAttendance.bind(attendanceController)
);

// Delete attendance record (Admin only)
router.delete(
  '/:id',
  authMiddleware.authorize(Role.ADMIN),
  attendanceController.deleteAttendance.bind(attendanceController)
);

export default router;
