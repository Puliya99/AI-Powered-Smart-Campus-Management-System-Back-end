import { Router } from 'express';
import kioskController from '../controllers/kiosk.controller';

const router = Router();

// All routes are PUBLIC (no auth) — accessed by classroom tablets/kiosks

// Attendance scanning
router.post('/scan/passkey', kioskController.scanByPasskey.bind(kioskController));
router.post('/scan/fingerprint', kioskController.scanByFingerprintId.bind(kioskController));

// WebAuthn fingerprint authentication
router.post('/webauthn/authenticate/start', kioskController.webauthnAuthenticateStart.bind(kioskController));
router.post('/webauthn/authenticate/finish', kioskController.webauthnAuthenticateFinish.bind(kioskController));

// Student lookup and schedule info
router.get('/student/by-passkey/:passkey', kioskController.getStudentByPasskey.bind(kioskController));
router.get('/schedule/current', kioskController.getCurrentScheduleInfo.bind(kioskController));

export default router;
