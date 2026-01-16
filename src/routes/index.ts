import { Router } from 'express';
import authRoutes from './auth.routes';
import passwordResetRoutes from './password-reset.routes';
import dashboardRoutes from './dashabord.routes';
import studentRoutes from './student.routes';
import lecturerRoutes from './lecturer.routes';
import programRoutes from './program.routes';
import moduleRoutes from './module.routes';
import batchRoutes from './batch.routes';
import scheduleRoutes from './schedule.routes';
import attendanceRoutes from './attendance.routes';
import centerRoutes from './center.routes';
import paymentRoutes from './payment.routes';
import reportRoutes from './report.routes';
import settingRoutes from './setting.routes';
import userRoutes from './user.routes';
import lectureNoteRoutes from './lectureNote.routes';
import videoMeetingRoutes from './videoMeeting.routes';
import quizRoutes from './quiz.routes';
import assignmentRoutes from './assignment.routes';
import resultRoutes from './result.routes';
import performanceRoutes from './performance.routes';
import feedbackRoutes from './feedback.routes';
import enrollmentRoutes from './enrollment.routes';
import notificationRoutes from './notification.routes';

const router = Router();

// Register routes
router.use('/auth', authRoutes);
router.use('/password', passwordResetRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/students', studentRoutes);
router.use('/lecturers', lecturerRoutes);
router.use('/programs', programRoutes);
router.use('/modules', moduleRoutes);
router.use('/batches', batchRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/centers', centerRoutes);
router.use('/payments', paymentRoutes);
router.use('/reports', reportRoutes);
router.use('/settings', settingRoutes);
router.use('/users', userRoutes);
router.use('/lecture-notes', lectureNoteRoutes);
router.use('/video-meetings', videoMeetingRoutes);
router.use('/quizzes', quizRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/results', resultRoutes);
router.use('/performance', performanceRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/enrollments', enrollmentRoutes);
router.use('/notifications', notificationRoutes);

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
        getAll: 'GET /api/v1/students',
        getById: 'GET /api/v1/students/:id',
        create: 'POST /api/v1/students',
        update: 'PUT /api/v1/students/:id',
        delete: 'DELETE /api/v1/students/:id',
        stats: 'GET /api/v1/students/stats',
        dropdown: 'GET /api/v1/students/dropdown',
      },
      lecturers: {
        getAll: 'GET /api/v1/lecturers',
        getById: 'GET /api/v1/lecturers/:id',
        create: 'POST /api/v1/lecturers',
        update: 'PUT /api/v1/lecturers/:id',
        delete: 'DELETE /api/v1/lecturers/:id',
        stats: 'GET /api/v1/lecturers/stats',
        dropdown: 'GET /api/v1/lecturers/dropdown',
      },
      programs: {
        getAll: 'GET /api/v1/programs',
        getById: 'GET /api/v1/programs/:id',
        create: 'POST /api/v1/programs',
        update: 'PUT /api/v1/programs/:id',
        delete: 'DELETE /api/v1/programs/:id',
        stats: 'GET /api/v1/programs/stats',
        dropdown: 'GET /api/v1/programs/dropdown',
      },
      modules: {
        getAll: 'GET /api/v1/modules',
        getById: 'GET /api/v1/modules/:id',
        create: 'POST /api/v1/modules',
        update: 'PUT /api/v1/modules/:id',
        delete: 'DELETE /api/v1/modules/:id',
        stats: 'GET /api/v1/modules/stats',
        dropdown: 'GET /api/v1/modules/dropdown',
      },
      batches: {
        getAll: 'GET /api/v1/batches',
        getById: 'GET /api/v1/batches/:id',
        create: 'POST /api/v1/batches',
        update: 'PUT /api/v1/batches/:id',
        delete: 'DELETE /api/v1/batches/:id',
        stats: 'GET /api/v1/batches/stats',
        dropdown: 'GET /api/v1/batches/dropdown',
        enrollments: 'GET /api/v1/batches/:id/enrollments',
      },
      schedules: {
        getAll: 'GET /api/v1/schedules',
        getById: 'GET /api/v1/schedules/:id',
        getByDate: 'GET /api/v1/schedules/date/:date',
        getLecturerSchedule: 'GET /api/v1/schedules/lecturer/:lecturerId',
        create: 'POST /api/v1/schedules',
        update: 'PUT /api/v1/schedules/:id',
        delete: 'DELETE /api/v1/schedules/:id',
        stats: 'GET /api/v1/schedules/stats',
      },
      attendance: {
        getAll: 'GET /api/v1/attendance',
        getById: 'GET /api/v1/attendance/:id',
        mark: 'POST /api/v1/attendance/mark',
        update: 'PUT /api/v1/attendance/:id',
        delete: 'DELETE /api/v1/attendance/:id',
        stats: 'GET /api/v1/attendance/stats',
        getScheduleAttendance: 'GET /api/v1/attendance/schedule/:scheduleId',
        getStudentReport: 'GET /api/v1/attendance/student/:studentId/report',
        getBatchSummary: 'GET /api/v1/attendance/batch/:batchId/summary',
      },
      centers: {
        getAll: 'GET /api/v1/centers',
        getById: 'GET /api/v1/centers/:id',
        create: 'POST /api/v1/centers',
        update: 'PUT /api/v1/centers/:id',
        delete: 'DELETE /api/v1/centers/:id',
        stats: 'GET /api/v1/centers/stats',
        dropdown: 'GET /api/v1/centers/dropdown',
      },
      payments: {
        getAll: 'GET /api/v1/payments',
        getById: 'GET /api/v1/payments/:id',
        create: 'POST /api/v1/payments',
        update: 'PUT /api/v1/payments/:id',
        delete: 'DELETE /api/v1/payments/:id',
        stats: 'GET /api/v1/payments/stats',
        getStudentPayments: 'GET /api/v1/payments/student',
        uploadReceipt: 'POST /api/v1/payments/:paymentId/receipt',
      },
      reports: {
        enrollment: 'GET /api/v1/reports/enrollment',
        payment: 'GET /api/v1/reports/payment',
        attendance: 'GET /api/v1/reports/attendance',
        stats: 'GET /api/v1/reports/stats',
      },
      settings: {
        getAll: 'GET /api/v1/settings',
        getByKey: 'GET /api/v1/settings/:key',
        upsert: 'POST /api/v1/settings',
        updateMultiple: 'PUT /api/v1/settings/bulk',
        delete: 'DELETE /api/v1/settings/:id',
      },
      users: {
        getAll: 'GET /api/v1/users',
        getById: 'GET /api/v1/users/:id',
        create: 'POST /api/v1/users',
        update: 'PUT /api/v1/users/:id',
        delete: 'DELETE /api/v1/users/:id',
        stats: 'GET /api/v1/users/stats',
      },
      lectureNotes: {
        getByModule: 'GET /api/v1/lecture-notes/module/:moduleId',
        create: 'POST /api/v1/lecture-notes',
        delete: 'DELETE /api/v1/lecture-notes/:id',
      },
      videoMeetings: {
        create: 'POST /api/v1/video-meetings',
        getMyActive: 'GET /api/v1/video-meetings/my-active',
        getHistory: 'GET /api/v1/video-meetings/history',
        getByCode: 'GET /api/v1/video-meetings/code/:code',
        getById: 'GET /api/v1/video-meetings/:id',
        join: 'POST /api/v1/video-meetings/:id/join',
        leave: 'POST /api/v1/video-meetings/:id/leave',
        end: 'PUT /api/v1/video-meetings/:id/end',
        getParticipants: 'GET /api/v1/video-meetings/:id/participants',
        getByModule: 'GET /api/v1/video-meetings/module/:moduleId',
      },
      quizzes: {
        create: 'POST /api/v1/quizzes',
        getByModule: 'GET /api/v1/quizzes/module/:moduleId',
        getById: 'GET /api/v1/quizzes/:id',
        addQuestions: 'POST /api/v1/quizzes/:quizId/questions',
        publish: 'PUT /api/v1/quizzes/:id/publish',
        startAttempt: 'POST /api/v1/quizzes/:quizId/start',
        submitAttempt: 'POST /api/v1/quizzes/attempts/:id/submit',
        getAttemptResults: 'GET /api/v1/quizzes/attempts/:id',
        getAttempts: 'GET /api/v1/quizzes/:quizId/attempts',
      },
      assignments: {
        getByModule: 'GET /api/v1/assignments/module/:moduleId',
        create: 'POST /api/v1/assignments',
        update: 'PUT /api/v1/assignments/:id',
        delete: 'DELETE /api/v1/assignments/:id',
        submit: 'POST /api/v1/assignments/:assignmentId/submit',
        getSubmissions: 'GET /api/v1/assignments/:assignmentId/submissions',
        markSubmission: 'PUT /api/v1/assignments/submissions/:id/mark',
        download: 'GET /api/v1/assignments/submissions/:id/download',
      },
      results: {
        getByModule: 'GET /api/v1/results/module/:moduleId',
        upsert: 'POST /api/v1/results',
        bulkUpsert: 'POST /api/v1/results/bulk',
        delete: 'DELETE /api/v1/results/:id',
        getMyResults: 'GET /api/v1/results/my-results',
      },
      performance: {
        getByStudent: 'GET /api/v1/performance/student/:studentId',
        getByBatch: 'GET /api/v1/performance/batch/:batchId',
        getOverall: 'GET /api/v1/performance/overall',
      },
      feedback: {
        submit: 'POST /api/v1/feedback/submit',
        getAll: 'GET /api/v1/feedback',
        getById: 'GET /api/v1/feedback/:id',
        respond: 'PUT /api/v1/feedback/:id/respond',
        delete: 'DELETE /api/v1/feedback/:id',
      },
    },
  });
});

export default router;
