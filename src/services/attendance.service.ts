import { AppDataSource } from '../config/database';
import { Attendance } from '../entities/Attendance.entity';
import { Schedule } from '../entities/Schedule.entity';
import { Student } from '../entities/Student.entity';
import { Enrollment } from '../entities/Enrollment.entity';
import { AttendanceStatus } from '../enums/AttendanceStatus.enum';

// Convert "HH:mm" to minutes since midnight
const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

class AttendanceService {
  private attendanceRepository = AppDataSource.getRepository(Attendance);
  private scheduleRepository = AppDataSource.getRepository(Schedule);
  private enrollmentRepository = AppDataSource.getRepository(Enrollment);
  private studentRepository = AppDataSource.getRepository(Student);

  /**
   * Core attendance scan logic — shared between fingerprint, passkey, and WebAuthn flows.
   * Finds matching schedule and creates/updates attendance (entry/exit).
   */
  async processAttendanceScan(
    student: Student,
    scheduleId?: string,
    timestamp?: Date
  ): Promise<{ action: 'ENTRY' | 'EXIT' | 'ALREADY_COMPLETED'; attendance: Attendance; student: { id: string; name: string; universityNumber: string } }> {
    const now = timestamp || new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentTimeHHmm = now.toTimeString().substring(0, 5);

    // Determine target schedule
    let schedule: Schedule | null = null;
    if (scheduleId) {
      schedule = await this.scheduleRepository.findOne({ where: { id: scheduleId }, relations: ['batch'] });
    } else {
      // Find student's active batches
      const activeEnrollments = await this.enrollmentRepository.createQueryBuilder('enrollment')
        .leftJoinAndSelect('enrollment.batch', 'batch')
        .leftJoin('enrollment.student', 'student')
        .where('student.id = :sid', { sid: student.id })
        .andWhere('enrollment.status = :status', { status: 'ACTIVE' })
        .getMany();
      const batchIds = activeEnrollments.map(e => e.batch?.id).filter(Boolean);

      if (batchIds.length === 0) {
        throw { statusCode: 404, code: 'NO_ACTIVE_ENROLLMENT', message: 'Student has no active enrollment/batch' };
      }

      // Time window with grace: start - 15min .. end + 30min
      const graceStartMinutes = 15;
      const graceEndMinutes = 30;

      const today = new Date(todayStr);
      const candidates = await this.scheduleRepository
        .createQueryBuilder('schedule')
        .leftJoin('schedule.batch', 'batch')
        .where('schedule.date = :today', { today })
        .andWhere('batch.id IN (:...batchIds)', { batchIds })
        .getMany();

      const nowMin = toMinutes(currentTimeHHmm);
      const within = candidates.filter(s => {
        const startMin = toMinutes(s.startTime) - graceStartMinutes;
        const endMin = toMinutes(s.endTime) + graceEndMinutes;
        return nowMin >= startMin && nowMin <= endMin;
      });

      if (within.length === 0) {
        throw { statusCode: 404, code: 'NO_ACTIVE_SCHEDULE', message: 'No matching schedule for the current time window' };
      }

      // Pick the schedule whose startTime is closest
      within.sort((a, b) => Math.abs(toMinutes(a.startTime) - nowMin) - Math.abs(toMinutes(b.startTime) - nowMin));
      schedule = within[0];
    }

    if (!schedule) {
      throw { statusCode: 404, code: 'SCHEDULE_NOT_FOUND', message: 'Schedule not found' };
    }

    // Find or create attendance
    let attendance = await this.attendanceRepository.findOne({
      where: { student: { id: student.id }, schedule: { id: schedule.id } },
      relations: ['student', 'schedule'],
    });

    // Determine late status (>10 min after start)
    const lateGrace = 10;
    const isLate = toMinutes(currentTimeHHmm) > (toMinutes(schedule.startTime) + lateGrace);

    // Get student name for response
    const studentWithUser = await this.studentRepository.findOne({
      where: { id: student.id },
      relations: ['user'],
    });
    const studentInfo = {
      id: student.id,
      name: studentWithUser?.user ? `${studentWithUser.user.firstName} ${studentWithUser.user.lastName}` : 'Unknown',
      universityNumber: student.universityNumber,
    };

    if (!attendance) {
      attendance = this.attendanceRepository.create({
        status: isLate ? AttendanceStatus.LATE : AttendanceStatus.PRESENT,
        markedAt: now,
        entryTime: now,
        remarks: null as any,
      });
      attendance.student = student;
      attendance.schedule = schedule;
      await this.attendanceRepository.save(attendance);
      return { action: 'ENTRY', attendance, student: studentInfo };
    }

    if (!attendance.entryTime) {
      attendance.entryTime = now;
      attendance.markedAt = now;
      if (isLate) attendance.status = AttendanceStatus.LATE;
      await this.attendanceRepository.save(attendance);
      return { action: 'ENTRY', attendance, student: studentInfo };
    }

    if (!attendance.exitTime) {
      attendance.exitTime = now;
      await this.attendanceRepository.save(attendance);
      return { action: 'EXIT', attendance, student: studentInfo };
    }

    return { action: 'ALREADY_COMPLETED', attendance, student: studentInfo };
  }

  /**
   * Generate a unique 6-digit passkey for a student (Gym Pro pattern).
   */
  async generateUniquePasskey(): Promise<number> {
    let unique = false;
    let passkey: number = 0;
    let attempts = 0;
    const maxAttempts = 100;

    while (!unique && attempts < maxAttempts) {
      passkey = Math.floor(100000 + Math.random() * 900000); // 6-digit
      const existing = await this.studentRepository.findOne({
        where: { passkey },
      });
      if (!existing) {
        unique = true;
      }
      attempts++;
    }

    if (!unique) {
      throw new Error('Failed to generate unique passkey. Please try again.');
    }

    return passkey;
  }

  /**
   * Find student by passkey.
   */
  async findStudentByPasskey(passkey: number): Promise<Student> {
    const student = await this.studentRepository.findOne({
      where: { passkey },
      relations: ['user'],
    });
    if (!student) {
      throw { statusCode: 404, code: 'INVALID_PASSKEY', message: 'No student found with this passkey' };
    }
    return student;
  }

  /**
   * Find student by fingerprintId.
   */
  async findStudentByFingerprintId(fingerprintId: string): Promise<Student> {
    const student = await this.studentRepository.findOne({
      where: { fingerprintId },
      relations: ['user'],
    });
    if (!student) {
      throw { statusCode: 404, code: 'UNKNOWN_FINGERPRINT', message: 'No student linked to this fingerprintId' };
    }
    return student;
  }
}

export default new AttendanceService();
