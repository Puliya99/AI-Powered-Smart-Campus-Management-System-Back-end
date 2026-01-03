import { AppDataSource } from '../config/database';
import { User } from '../entities/User.entity';
import { Student } from '../entities/Student.entity';
import { Lecturer } from '../entities/Lecturer.entity';
import { Attendance } from '../entities/Attendance.entity';
import { Payment } from '../entities/Payment.entity';
import { Result } from '../entities/Result.entity';
import { Assignment } from '../entities/Assignment.entity';
import { Enrollment } from '../entities/Enrollment.entity';
import { Schedule } from '../entities/Schedule.entity';
import { Role } from '../enums/Role.enum';

export class DashboardService {
  private userRepository = AppDataSource.getRepository(User);
  private studentRepository = AppDataSource.getRepository(Student);
  private lecturerRepository = AppDataSource.getRepository(Lecturer);
  private attendanceRepository = AppDataSource.getRepository(Attendance);
  private paymentRepository = AppDataSource.getRepository(Payment);
  private resultRepository = AppDataSource.getRepository(Result);
  private assignmentRepository = AppDataSource.getRepository(Assignment);
  private enrollmentRepository = AppDataSource.getRepository(Enrollment);
  private scheduleRepository = AppDataSource.getRepository(Schedule);

  // Admin Dashboard Stats
  async getAdminDashboard() {
    const [
      totalStudents,
      totalLecturers,
      totalStaff,
      activeEnrollments,
      todayAttendance,
      pendingPayments,
      recentUsers,
    ] = await Promise.all([
      this.userRepository.count({ where: { role: Role.STUDENT, isActive: true } }),
      this.userRepository.count({ where: { role: Role.LECTURER, isActive: true } }),
      this.userRepository.count({ where: { role: Role.USER, isActive: true } }),
      this.enrollmentRepository.count({ where: { status: 'ACTIVE' as any } }),
      this.attendanceRepository
        .createQueryBuilder('attendance')
        .where('DATE(attendance.createdAt) = CURRENT_DATE')
        .getCount(),
      this.paymentRepository.count({ where: { status: 'UNPAID' as any } }),
      this.userRepository.find({
        take: 5,
        order: { createdAt: 'DESC' },
        select: ['id', 'firstName', 'lastName', 'email', 'role', 'createdAt'],
      }),
    ]);

    // Get monthly enrollment trend (last 6 months)
    const enrollmentTrend = await this.getEnrollmentTrend();

    // Get attendance statistics
    const attendanceStats = await this.getAttendanceStats();

    return {
      stats: {
        totalStudents,
        totalLecturers,
        totalStaff,
        activeEnrollments,
        todayAttendance,
        pendingPayments,
        totalUsers: totalStudents + totalLecturers + totalStaff,
      },
      charts: {
        enrollmentTrend,
        attendanceStats,
      },
      recentUsers,
    };
  }

  // Student Dashboard Stats
  async getStudentDashboard(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['student'],
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get student data
    const student = await this.studentRepository.findOne({
      where: { user: { id: userId } },
      relations: ['enrollments', 'attendances', 'assignments', 'results', 'payments'],
    });

    if (!student) {
      throw new Error('Student record not found');
    }

    const [
      enrolledCourses,
      attendanceRate,
      pendingAssignments,
      averageGrade,
      upcomingClasses,
      recentResults,
      paymentStatus,
    ] = await Promise.all([
      this.enrollmentRepository.count({
        where: { student: { id: student.id }, status: 'ACTIVE' as any },
      }),
      this.calculateAttendanceRate(student.id),
      this.assignmentRepository.count({
        where: { student: { id: student.id }, submissionStatus: 'NOT_SUBMITTED' as any },
      }),
      this.calculateAverageGrade(student.id),
      this.getUpcomingClasses(student.id),
      this.resultRepository.find({
        where: { student: { id: student.id } },
        take: 5,
        order: { createdAt: 'DESC' },
        relations: ['module'],
      }),
      this.getPaymentStatus(student.id),
    ]);

    return {
      profile: {
        name: `${user.firstName} ${user.lastName}`,
        registrationNumber: user.registrationNumber,
        email: user.email,
      },
      stats: {
        enrolledCourses,
        attendanceRate: Math.round(attendanceRate),
        pendingAssignments,
        averageGrade: averageGrade.toFixed(2),
      },
      upcomingClasses,
      recentResults,
      paymentStatus,
    };
  }

  // Lecturer Dashboard Stats
  async getLecturerDashboard(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const lecturer = await this.lecturerRepository.findOne({
      where: { user: { id: userId } },
      relations: ['modules', 'schedules'],
    });

    if (!lecturer) {
      throw new Error('Lecturer record not found');
    }

    const [
      totalClasses,
      todayClasses,
      totalStudents,
      pendingGrading,
      upcomingClasses,
      classPerformance,
    ] = await Promise.all([
      this.scheduleRepository.count({
        where: { lecturer: { id: lecturer.id } },
      }),
      this.scheduleRepository
        .createQueryBuilder('schedule')
        .where('schedule.lecturerId = :lecturerId', { lecturerId: lecturer.id })
        .andWhere('DATE(schedule.date) = CURRENT_DATE')
        .getCount(),
      this.getEnrolledStudentsCount(lecturer.id),
      this.assignmentRepository
        .createQueryBuilder('assignment')
        .where('assignment.moduleId IN (SELECT id FROM module WHERE lecturerId = :lecturerId)', {
          lecturerId: lecturer.id,
        })
        .andWhere('assignment.marks IS NULL')
        .getCount(),
      this.getLecturerUpcomingClasses(lecturer.id),
      this.getClassPerformance(lecturer.id),
    ]);

    return {
      profile: {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
      },
      stats: {
        totalClasses,
        todayClasses,
        totalStudents,
        pendingGrading,
      },
      upcomingClasses,
      classPerformance,
    };
  }

  // Staff Dashboard Stats
  async getStaffDashboard(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const [todayEnrollments, pendingDocuments, recentRegistrations, upcomingEvents] =
      await Promise.all([
        this.enrollmentRepository
          .createQueryBuilder('enrollment')
          .where('DATE(enrollment.createdAt) = CURRENT_DATE')
          .getCount(),
        0, // Placeholder for documents
        this.userRepository.find({
          take: 10,
          order: { createdAt: 'DESC' },
          where: { role: Role.STUDENT },
          select: ['id', 'firstName', 'lastName', 'email', 'registrationNumber', 'createdAt'],
        }),
        this.scheduleRepository.find({
          take: 5,
          where: {
            date: new Date(),
          },
          relations: ['module', 'batch'],
          order: { startTime: 'ASC' },
        }),
      ]);

    return {
      profile: {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
      },
      stats: {
        todayEnrollments,
        pendingDocuments,
        totalRegistrations: recentRegistrations.length,
      },
      recentRegistrations,
      upcomingEvents,
    };
  }

  // Helper Methods
  private async getEnrollmentTrend() {
    // Get last 6 months of enrollment data
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthName = date.toLocaleString('default', { month: 'short' });

      const count = await this.enrollmentRepository
        .createQueryBuilder('enrollment')
        .where('EXTRACT(MONTH FROM enrollment.enrollmentDate) = :month', {
          month: date.getMonth() + 1,
        })
        .andWhere('EXTRACT(YEAR FROM enrollment.enrollmentDate) = :year', {
          year: date.getFullYear(),
        })
        .getCount();

      months.push({ month: monthName, count });
    }
    return months;
  }

  private async getAttendanceStats() {
    const total = await this.attendanceRepository.count();
    const present = await this.attendanceRepository.count({
      where: { status: 'PRESENT' as any },
    });
    const absent = await this.attendanceRepository.count({
      where: { status: 'ABSENT' as any },
    });

    return {
      present,
      absent,
      late: total - present - absent,
      total,
      rate: total > 0 ? Math.round((present / total) * 100) : 0,
    };
  }

  private async calculateAttendanceRate(studentId: string): Promise<number> {
    const total = await this.attendanceRepository.count({
      where: { student: { id: studentId } },
    });

    if (total === 0) return 0;

    const present = await this.attendanceRepository.count({
      where: { student: { id: studentId }, status: 'PRESENT' as any },
    });

    return (present / total) * 100;
  }

  private async calculateAverageGrade(studentId: string): Promise<number> {
    const results = await this.resultRepository.find({
      where: { student: { id: studentId } },
    });

    if (results.length === 0) return 0;

    const total = results.reduce((sum, result) => sum + (result.marks / result.maxMarks) * 100, 0);
    return total / results.length;
  }

  private async getUpcomingClasses(studentId: string) {
    // Placeholder - implement based on your schedule structure
    return [];
  }

  private async getLecturerUpcomingClasses(lecturerId: string) {
    return this.scheduleRepository.find({
      where: {
        lecturer: { id: lecturerId },
        date: new Date(),
      },
      take: 5,
      relations: ['module', 'batch'],
      order: { startTime: 'ASC' },
    });
  }

  private async getPaymentStatus(studentId: string) {
    const payments = await this.paymentRepository.find({
      where: { student: { id: studentId } },
      order: { paymentDate: 'DESC' },
      take: 1,
    });

    return payments[0] || null;
  }

  private async getEnrolledStudentsCount(lecturerId: string): Promise<number> {
    // Count unique students enrolled in lecturer's modules
    return 0; // Placeholder
  }

  private async getClassPerformance(lecturerId: string) {
    // Get average performance across all classes
    return {
      average: 75,
      trend: 'up',
    };
  }
}

export default new DashboardService();
