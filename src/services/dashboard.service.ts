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
import { ScheduleStatus } from '../enums/ScheduleStatus.enum';
import { In, MoreThanOrEqual } from 'typeorm';

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
    // Auto-complete finished schedules before fetching stats
    await this.autoCompleteFinishedSchedules();

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
    // Auto-complete finished schedules before fetching stats
    await this.autoCompleteFinishedSchedules();

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
      relations: ['enrollments', 'attendances', 'submissions', 'results', 'payments'],
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
      enrolledModules,
    ] = await Promise.all([
      this.enrollmentRepository.count({
        where: { student: { id: student.id }, status: 'ACTIVE' as any },
      }),
      this.calculateAttendanceRate(student.id),
      AppDataSource.getRepository('Submission').count({
        where: { student: { id: student.id }, status: 'SUBMITTED' as any },
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
      this.getEnrolledModules(student.id),
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
        completedAssignments: pendingAssignments,
        averageGrade: averageGrade.toFixed(2),
      },
      upcomingClasses,
      recentResults,
      paymentStatus,
      enrolledModules,
    };
  }

  private async getEnrolledModules(studentId: string) {
    // Get programs the student is enrolled in
    const enrollments = await this.enrollmentRepository.find({
      where: { student: { id: studentId }, status: 'ACTIVE' as any },
      relations: ['program', 'program.modules'],
    });

    const modules: any[] = [];
    enrollments.forEach(enrollment => {
      if (enrollment.program && enrollment.program.modules) {
        enrollment.program.modules.forEach(module => {
          modules.push({
            id: module.id,
            moduleCode: module.moduleCode,
            moduleName: module.moduleName,
            semesterNumber: module.semesterNumber,
            credits: module.credits,
          });
        });
      }
    });

    return modules;
  }

  // Lecturer Dashboard Stats
  async getLecturerDashboard(userId: string) {
    // Auto-complete finished schedules before fetching stats
    await this.autoCompleteFinishedSchedules();

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
      this.scheduleRepository.count({
        where: { 
          lecturer: { id: lecturer.id },
          date: new Date().toISOString().split('T')[0] as any
        },
      }),
      this.getEnrolledStudentsCount(lecturer.id),
      AppDataSource.getRepository('Submission')
        .createQueryBuilder('submission')
        .innerJoin('submission.assignment', 'assignment')
        .innerJoin('assignment.module', 'module')
        .where('module.lecturerId = :lecturerId', {
          lecturerId: lecturer.id,
        })
        .andWhere('submission.marks IS NULL')
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
    // Auto-complete finished schedules before fetching stats
    await this.autoCompleteFinishedSchedules();

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
    const today = new Date().toISOString().split('T')[0];
    
    // Get active enrollments for the student
    const enrollments = await this.enrollmentRepository.find({
      where: { student: { id: studentId }, status: 'ACTIVE' as any },
      relations: ['batch'],
    });

    const batchIds = enrollments.map(e => e.batch?.id).filter(id => !!id);

    if (batchIds.length === 0) {
      return [];
    }

    // Get upcoming schedules for these batches
    return AppDataSource.getRepository(Schedule).find({
      where: {
        batch: { id: In(batchIds) },
        date: MoreThanOrEqual(today as any),
        status: ScheduleStatus.SCHEDULED,
      },
      take: 5,
      relations: ['module', 'batch', 'lecturer', 'lecturer.user'],
      order: { date: 'ASC', startTime: 'ASC' },
    });
  }

  private async getLecturerUpcomingClasses(lecturerId: string) {
    const today = new Date().toISOString().split('T')[0];
    return this.scheduleRepository.find({
      where: {
        lecturer: { id: lecturerId },
        date: today as any,
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
    // Count unique students enrolled in programs that contain modules assigned to this lecturer
    const count = await this.enrollmentRepository
      .createQueryBuilder('enrollment')
      .innerJoin('enrollment.program', 'program')
      .innerJoin('program.modules', 'module')
      .where('module.lecturerId = :lecturerId', { lecturerId })
      .andWhere('enrollment.status = :status', { status: 'ACTIVE' })
      .select('COUNT(DISTINCT enrollment.studentId)', 'count')
      .getRawOne();

    return parseInt(count.count || '0');
  }

  private async getClassPerformance(lecturerId: string) {
    // Get average performance across all modules assigned to this lecturer
    const performance = await this.resultRepository
      .createQueryBuilder('result')
      .innerJoin('result.module', 'module')
      .where('module.lecturerId = :lecturerId', { lecturerId })
      .select('AVG((result.marks * 100.0) / result.maxMarks)', 'average')
      .getRawOne();

    const avg = parseFloat(performance.average || '0');

    // For trend, we could compare with previous month, but for MVP let's return 'up' if > 50
    return {
      average: Math.round(avg),
      trend: avg >= 50 ? 'up' : 'down',
    };
  }

  // Internal helper to automatically complete finished schedules
  private async autoCompleteFinishedSchedules() {
    try {
      const now = new Date();
      const currentDate = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:mm

      // Find all scheduled sessions that have already ended
      const finishedSchedules = await this.scheduleRepository
        .createQueryBuilder('schedule')
        .where('schedule.status = :status', { status: ScheduleStatus.SCHEDULED })
        .andWhere('(schedule.date < :currentDate OR (schedule.date = :currentDate AND schedule.endTime < :currentTime))', {
          currentDate,
          currentTime,
        })
        .getMany();

      if (finishedSchedules.length > 0) {
        for (const schedule of finishedSchedules) {
          schedule.status = ScheduleStatus.COMPLETED;
        }
        await this.scheduleRepository.save(finishedSchedules);
      }
    } catch (error) {
      console.error('Error in autoCompleteFinishedSchedules:', error);
    }
  }
}

export default new DashboardService();
