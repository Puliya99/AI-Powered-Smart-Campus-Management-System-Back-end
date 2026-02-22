import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Student } from '../entities/Student.entity';
import { Schedule } from '../entities/Schedule.entity';
import { WebAuthnCredential } from '../entities/WebAuthnCredential.entity';
import attendanceService from '../services/attendance.service';
import { env } from '../config/env';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';

// In-memory challenge store with TTL (60 seconds)
const challengeStore = new Map<string, { challenge: string; expiresAt: number }>();

// Clean up expired challenges periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of challengeStore.entries()) {
    if (now > value.expiresAt) {
      challengeStore.delete(key);
    }
  }
}, 60000);

export class KioskController {
  private studentRepository = AppDataSource.getRepository(Student);
  private scheduleRepository = AppDataSource.getRepository(Schedule);
  private credentialRepository = AppDataSource.getRepository(WebAuthnCredential);

  // Scan by 6-digit passkey — primary kiosk method
  async scanByPasskey(req: Request, res: Response) {
    try {
      const { passkey } = req.body;
      if (!passkey || typeof passkey !== 'number') {
        return res.status(400).json({ status: 'error', message: 'passkey (number) is required' });
      }

      const student = await attendanceService.findStudentByPasskey(passkey);
      const result = await attendanceService.processAttendanceScan(student);

      return res.json({ status: 'success', data: result });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({ status: 'error', code: error.code, message: error.message || 'Failed to process passkey scan' });
    }
  }

  // Scan by hardware fingerprint ID
  async scanByFingerprintId(req: Request, res: Response) {
    try {
      const { fingerprintId } = req.body;
      if (!fingerprintId || typeof fingerprintId !== 'string') {
        return res.status(400).json({ status: 'error', message: 'fingerprintId is required' });
      }

      const student = await attendanceService.findStudentByFingerprintId(fingerprintId);
      const result = await attendanceService.processAttendanceScan(student);

      return res.json({ status: 'success', data: result });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({ status: 'error', code: error.code, message: error.message || 'Failed to process fingerprint scan' });
    }
  }

  // Start WebAuthn authentication — student enters passkey first, then scans finger
  async webauthnAuthenticateStart(req: Request, res: Response) {
    try {
      const { passkey } = req.body;
      if (!passkey || typeof passkey !== 'number') {
        return res.status(400).json({ status: 'error', message: 'passkey (number) is required' });
      }

      const student = await attendanceService.findStudentByPasskey(passkey);

      // Get student's registered WebAuthn credentials
      const credentials = await this.credentialRepository.find({
        where: { student: { id: student.id } },
      });

      if (credentials.length === 0) {
        return res.status(404).json({ status: 'error', code: 'NO_CREDENTIALS', message: 'No fingerprint registered for this student. Please register in settings first.' });
      }

      const options = await generateAuthenticationOptions({
        rpID: env.WEBAUTHN_RP_ID,
        allowCredentials: credentials.map(cred => ({
          id: cred.credentialId,
          transports: (cred.transports || []) as AuthenticatorTransportFuture[],
        })),
        userVerification: 'required',
      });

      // Store challenge with 60-second TTL
      challengeStore.set(`auth_${passkey}`, {
        challenge: options.challenge,
        expiresAt: Date.now() + 60000,
      });

      return res.json({ status: 'success', data: { options } });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({ status: 'error', code: error.code, message: error.message || 'Failed to start authentication' });
    }
  }

  // Finish WebAuthn authentication and mark attendance
  async webauthnAuthenticateFinish(req: Request, res: Response) {
    try {
      const { passkey, authenticationResponse } = req.body;
      if (!passkey || !authenticationResponse) {
        return res.status(400).json({ status: 'error', message: 'passkey and authenticationResponse are required' });
      }

      // Retrieve stored challenge
      const stored = challengeStore.get(`auth_${passkey}`);
      if (!stored || Date.now() > stored.expiresAt) {
        challengeStore.delete(`auth_${passkey}`);
        return res.status(400).json({ status: 'error', code: 'CHALLENGE_EXPIRED', message: 'Authentication challenge expired. Please try again.' });
      }
      challengeStore.delete(`auth_${passkey}`);

      const student = await attendanceService.findStudentByPasskey(passkey);

      // Find the credential used
      const credential = await this.credentialRepository.findOne({
        where: { credentialId: authenticationResponse.id },
        relations: ['student'],
      });

      if (!credential || credential.student.id !== student.id) {
        return res.status(400).json({ status: 'error', code: 'INVALID_CREDENTIAL', message: 'Credential does not belong to this student' });
      }

      // Verify the authentication response
      const verification = await verifyAuthenticationResponse({
        response: authenticationResponse as AuthenticationResponseJSON,
        expectedChallenge: stored.challenge,
        expectedOrigin: env.WEBAUTHN_ORIGIN,
        expectedRPID: env.WEBAUTHN_RP_ID,
        credential: {
          id: credential.credentialId,
          publicKey: Buffer.from(credential.credentialPublicKey, 'base64url'),
          counter: Number(credential.counter),
          transports: (credential.transports || []) as AuthenticatorTransportFuture[],
        },
      });

      if (!verification.verified) {
        return res.status(400).json({ status: 'error', code: 'VERIFICATION_FAILED', message: 'Fingerprint verification failed' });
      }

      // Update counter
      credential.counter = verification.authenticationInfo.newCounter;
      await this.credentialRepository.save(credential);

      // Process attendance
      const result = await attendanceService.processAttendanceScan(student);

      return res.json({ status: 'success', data: result });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({ status: 'error', code: error.code, message: error.message || 'Failed to verify authentication' });
    }
  }

  // Look up student info by passkey (for kiosk display)
  async getStudentByPasskey(req: Request, res: Response) {
    try {
      const passkey = parseInt(req.params.passkey, 10);
      if (isNaN(passkey)) {
        return res.status(400).json({ status: 'error', message: 'Invalid passkey' });
      }

      const student = await this.studentRepository.findOne({
        where: { passkey },
        relations: ['user'],
        select: {
          id: true,
          universityNumber: true,
          user: {
            id: true,
            firstName: true,
            lastName: true,
            profilePic: true,
          },
        },
      });

      if (!student) {
        return res.status(404).json({ status: 'error', message: 'Student not found' });
      }

      return res.json({
        status: 'success',
        data: {
          id: student.id,
          name: `${student.user.firstName} ${student.user.lastName}`,
          universityNumber: student.universityNumber,
          profilePic: student.user.profilePic,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message || 'Failed to fetch student' });
    }
  }

  // Get current/upcoming schedule for kiosk display
  async getCurrentScheduleInfo(req: Request, res: Response) {
    try {
      const { lectureHall } = req.query;
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const currentTimeHHmm = now.toTimeString().substring(0, 5);

      const toMinutes = (hhmm: string) => {
        const [h, m] = hhmm.split(':').map(Number);
        return h * 60 + m;
      };
      const nowMin = toMinutes(currentTimeHHmm);

      const queryBuilder = this.scheduleRepository
        .createQueryBuilder('schedule')
        .leftJoinAndSelect('schedule.module', 'module')
        .leftJoinAndSelect('schedule.batch', 'batch')
        .leftJoinAndSelect('schedule.lecturer', 'lecturer')
        .leftJoinAndSelect('lecturer.user', 'lecturerUser')
        .where('schedule.date = :today', { today: todayStr });

      if (lectureHall) {
        queryBuilder.andWhere('schedule.lectureHall = :lectureHall', { lectureHall });
      }

      const schedules = await queryBuilder.getMany();

      // Filter to schedules within time window (15min before start to 30min after end)
      const active = schedules.filter(s => {
        const startMin = toMinutes(s.startTime) - 15;
        const endMin = toMinutes(s.endTime) + 30;
        return nowMin >= startMin && nowMin <= endMin;
      });

      // Sort by proximity to current time
      active.sort((a, b) => Math.abs(toMinutes(a.startTime) - nowMin) - Math.abs(toMinutes(b.startTime) - nowMin));

      const current = active[0] || null;

      return res.json({
        status: 'success',
        data: {
          currentSchedule: current ? {
            id: current.id,
            moduleName: current.module?.moduleName || 'Unknown',
            moduleCode: current.module?.moduleCode || '',
            batchNumber: current.batch?.batchNumber || '',
            lecturer: current.lecturer?.user ? `${current.lecturer.user.firstName} ${current.lecturer.user.lastName}` : 'Unknown',
            lectureHall: current.lectureHall,
            startTime: current.startTime,
            endTime: current.endTime,
            date: current.date,
          } : null,
          upcomingSchedules: active.slice(1).map(s => ({
            id: s.id,
            moduleName: s.module?.moduleName || 'Unknown',
            startTime: s.startTime,
            endTime: s.endTime,
          })),
        },
      });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message || 'Failed to fetch schedule info' });
    }
  }
}

export default new KioskController();
