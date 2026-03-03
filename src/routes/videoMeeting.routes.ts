import { Router } from 'express';
import videoMeetingController from '../controllers/videoMeeting.controller';
import authMiddleware from '../middleware/auth.middleware';
import { Role } from '../enums/Role.enum';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate.bind(authMiddleware));

// Create a meeting (Lecturer only)
router.post(
  '/',
  authMiddleware.authorize(Role.LECTURER, Role.USER),
  videoMeetingController.createMeeting.bind(videoMeetingController)
);

// Get my active meetings (lecturer)
router.get('/my-active', videoMeetingController.getMyActiveMeetings.bind(videoMeetingController));

// Get active meetings for student's enrolled batches
router.get('/student-active', videoMeetingController.getStudentActiveMeetings.bind(videoMeetingController));

// Get meeting history
router.get('/history', videoMeetingController.getMeetingHistory.bind(videoMeetingController));

// Get meeting by code
router.get('/code/:code', videoMeetingController.getMeetingByCode.bind(videoMeetingController));

// Get meeting by ID
router.get('/:id', videoMeetingController.getMeetingById.bind(videoMeetingController));

// Join meeting
router.post('/:id/join', videoMeetingController.joinMeeting.bind(videoMeetingController));

// Leave meeting
router.post('/:id/leave', videoMeetingController.leaveMeeting.bind(videoMeetingController));

// End meeting
router.put(
  '/:id/end',
  authMiddleware.authorize(Role.LECTURER, Role.USER),
  videoMeetingController.endMeeting.bind(videoMeetingController)
);

// Get meeting participants
router.get('/:id/participants', videoMeetingController.getMeetingParticipants.bind(videoMeetingController));

// Get online attendance for a meeting (Lecturer and Admin only)
router.get(
  '/:id/attendance',
  authMiddleware.authorize(Role.LECTURER, Role.USER, Role.ADMIN),
  videoMeetingController.getMeetingAttendance.bind(videoMeetingController)
);

// Get active meetings for a module
router.get('/module/:moduleId', videoMeetingController.getActiveMeetingsByModule.bind(videoMeetingController));

export default router;
