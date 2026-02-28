import { Router } from 'express';
import studentController from '../controllers/student.controller';
import authMiddleware from '../middleware/auth.middleware';
import { Role } from '../enums/Role.enum';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate.bind(authMiddleware));

// Get all students (Admin and Staff only)
router.get(
  '/',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  studentController.getAllStudents.bind(studentController)
);

// Get student statistics (Admin and Staff)
router.get(
  '/stats',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  studentController.getStudentStats.bind(studentController)
);

// Get students with fingerprint/passkey status (Admin only)
router.get(
  '/fingerprint-status',
  authMiddleware.authorize(Role.ADMIN),
  studentController.getStudentsWithFingerprintStatus.bind(studentController)
);

// Get currently logged in student's own profile
router.get(
  '/me',
  authMiddleware.authorize(Role.STUDENT),
  studentController.getMyProfile.bind(studentController)
);

// Get currently logged in student's enrolled courses
router.get(
  '/my-courses',
  authMiddleware.authorize(Role.STUDENT),
  studentController.getMyCourses.bind(studentController)
);

// Get currently logged in student's schedule
router.get(
  '/my-schedule',
  authMiddleware.authorize(Role.STUDENT),
  studentController.getMySchedule.bind(studentController)
);

// Get students dropdown (Admin and Staff only)
router.get(
  '/dropdown',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  studentController.getStudentsDropdown.bind(studentController)
);

// ==================== WebAuthn Routes (Student only) ====================

// Start WebAuthn fingerprint registration
router.post(
  '/me/webauthn/register/start',
  authMiddleware.authorize(Role.STUDENT),
  studentController.webauthnRegisterStart.bind(studentController)
);

// Finish WebAuthn fingerprint registration
router.post(
  '/me/webauthn/register/finish',
  authMiddleware.authorize(Role.STUDENT),
  studentController.webauthnRegisterFinish.bind(studentController)
);

// Get registered WebAuthn credentials
router.get(
  '/me/webauthn/credentials',
  authMiddleware.authorize(Role.STUDENT),
  studentController.getWebauthnCredentials.bind(studentController)
);

// Delete a WebAuthn credential
router.delete(
  '/me/webauthn/credentials/:credentialId',
  authMiddleware.authorize(Role.STUDENT),
  studentController.deleteWebauthnCredential.bind(studentController)
);

// ==================== Passkey Routes ====================

// Get my passkey (Student)
router.get(
  '/me/passkey',
  authMiddleware.authorize(Role.STUDENT),
  studentController.getMyPasskey.bind(studentController)
);

// Generate passkey for myself (Student)
router.post(
  '/me/passkey/generate',
  authMiddleware.authorize(Role.STUDENT),
  studentController.generateMyPasskey.bind(studentController)
);

// Admin: Regenerate passkey for a student
router.post(
  '/:id/passkey/regenerate',
  authMiddleware.authorize(Role.ADMIN),
  studentController.regenerateStudentPasskey.bind(studentController)
);

// ==================== CRUD Routes ====================

// Get student by ID (Admin, Staff, and own student)
router.get('/:id', studentController.getStudentById.bind(studentController));

// Create student (Admin and Staff only)
router.post(
  '/',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  studentController.createStudent.bind(studentController)
);

// Update student (Admin and Staff only)
router.put(
  '/:id',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  studentController.updateStudent.bind(studentController)
);

// Delete/deactivate student (Admin only)
router.delete(
  '/:id',
  authMiddleware.authorize(Role.ADMIN),
  studentController.deleteStudent.bind(studentController)
);

export default router;
