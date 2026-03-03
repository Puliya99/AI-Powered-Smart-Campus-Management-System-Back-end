import { AppDataSource } from '../config/database';
import { Schedule } from '../entities/Schedule.entity';
import { Enrollment } from '../entities/Enrollment.entity';
import { ScheduleStatus } from '../enums/ScheduleStatus.enum';
import { ScheduleCategory } from '../enums/ScheduleCategory.enum';
import { EnrollmentStatus } from '../enums/EnrollmentStatus.enum';
import { NotificationType } from '../enums/NotificationType.enum';
import notificationService from './notification.service';

export class TimetableReminderService {
  private intervalId: NodeJS.Timeout | null = null;

  public start() {
    console.log('📅 Timetable Reminder Service started.');

    // Run once on start with a delay to allow DB to initialize
    setTimeout(() => {
      this.sendTodayReminders();
    }, 15000);

    // Run daily (24 hours)
    const ONE_DAY = 24 * 60 * 60 * 1000;
    this.intervalId = setInterval(() => {
      this.sendTodayReminders();
    }, ONE_DAY);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('🛑 Timetable Reminder Service stopped.');
  }

  private async sendTodayReminders() {
    try {
      console.log('📅 Sending timetable reminders for today...');

      const scheduleRepository = AppDataSource.getRepository(Schedule);
      const enrollmentRepository = AppDataSource.getRepository(Enrollment);

      const todayStr = new Date().toISOString().split('T')[0];

      // Get all class-type schedules for today that are still scheduled
      const todaySchedules = await scheduleRepository.find({
        where: {
          date: new Date(todayStr),
          status: ScheduleStatus.SCHEDULED,
          category: ScheduleCategory.CLASS,
        },
        relations: ['module', 'batch', 'lecturer', 'lecturer.user'],
      });

      let remindersSent = 0;

      for (const schedule of todaySchedules) {
        try {
          const scheduleName = schedule.module?.moduleName || 'Class';
          const timeRange = `${schedule.startTime} - ${schedule.endTime}`;
          const hallInfo = schedule.lectureHall ? ` in ${schedule.lectureHall}` : '';

          // Notify students in the batch
          if (schedule.batch) {
            const enrollments = await enrollmentRepository.find({
              where: { batch: { id: schedule.batch.id }, status: EnrollmentStatus.ACTIVE },
              relations: ['student', 'student.user'],
            });

            const studentUserIds = enrollments.map(e => e.student.user.id);

            if (studentUserIds.length > 0) {
              await notificationService.createNotifications({
                userIds: studentUserIds,
                title: `Today's Class: ${scheduleName}`,
                message: `Reminder: You have a class for ${scheduleName} today at ${timeRange}${hallInfo}.`,
                type: NotificationType.SCHEDULE,
                link: '/student/schedule',
              });
              remindersSent += studentUserIds.length;
            }
          }

          // Notify the lecturer
          if (schedule.lecturer) {
            await notificationService.createNotification({
              userId: schedule.lecturer.user.id,
              title: `Today's Class: ${scheduleName}`,
              message: `Reminder: You have a class to teach for ${scheduleName} today at ${timeRange}${hallInfo}.`,
              type: NotificationType.SCHEDULE,
              link: '/lecturer/schedule',
            });
            remindersSent++;
          }
        } catch (error) {
          console.error(`Failed to send timetable reminder for schedule ${schedule.id}:`, error);
        }
      }

      console.log(`📅 Timetable reminder complete: ${todaySchedules.length} class(es), ${remindersSent} reminders sent.`);
    } catch (error) {
      console.error('Error in timetable reminder service:', error);
    }
  }
}

export default new TimetableReminderService();
