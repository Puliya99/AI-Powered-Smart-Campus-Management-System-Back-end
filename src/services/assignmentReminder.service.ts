import { AppDataSource } from '../config/database';
import { Assignment } from '../entities/Assignment.entity';
import { Enrollment } from '../entities/Enrollment.entity';
import { EnrollmentStatus } from '../enums/EnrollmentStatus.enum';
import { NotificationType } from '../enums/NotificationType.enum';
import notificationService from './notification.service';

export class AssignmentReminderService {
  private intervalId: NodeJS.Timeout | null = null;

  public start() {
    console.log('📝 Assignment Reminder Service started.');

    // Run once on start with a delay to allow DB to initialize
    setTimeout(() => {
      this.checkAndRemind();
    }, 25000);

    // Run daily (24 hours)
    const ONE_DAY = 24 * 60 * 60 * 1000;
    this.intervalId = setInterval(() => {
      this.checkAndRemind();
    }, ONE_DAY);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('🛑 Assignment Reminder Service stopped.');
  }

  private async checkAndRemind() {
    try {
      console.log('📝 Running assignment reminder check...');

      const assignmentRepository = AppDataSource.getRepository(Assignment);
      const enrollmentRepository = AppDataSource.getRepository(Enrollment);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const threeDaysFromNow = new Date(today);
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      threeDaysFromNow.setHours(23, 59, 59, 999);

      // Find assignments due within the next 3 days
      const upcomingAssignments = await assignmentRepository
        .createQueryBuilder('assignment')
        .leftJoinAndSelect('assignment.module', 'module')
        .leftJoinAndSelect('module.program', 'program')
        .leftJoinAndSelect('assignment.submissions', 'submission')
        .leftJoinAndSelect('submission.student', 'submittedStudent')
        .where('assignment.dueDate >= :today', { today })
        .andWhere('assignment.dueDate <= :threeDaysFromNow', { threeDaysFromNow })
        .getMany();

      let remindersSent = 0;

      for (const assignment of upcomingAssignments) {
        if (!assignment.module?.program) continue;

        const dueDate = new Date(assignment.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const daysUntilDue = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // Only notify at specific milestones to avoid spamming
        if (daysUntilDue !== 3 && daysUntilDue !== 1 && daysUntilDue !== 0) continue;

        // Collect IDs of students who already submitted
        const submittedStudentIds = new Set(
          (assignment.submissions || []).map(s => s.student?.id).filter(Boolean)
        );

        // Find all active students enrolled in batches of this assignment's program
        const enrollments = await enrollmentRepository
          .createQueryBuilder('enrollment')
          .leftJoinAndSelect('enrollment.student', 'student')
          .leftJoinAndSelect('student.user', 'user')
          .innerJoin('enrollment.batch', 'batch')
          .innerJoin('batch.program', 'batchProgram')
          .where('enrollment.status = :status', { status: EnrollmentStatus.ACTIVE })
          .andWhere('batchProgram.id = :programId', { programId: assignment.module.program.id })
          .getMany();

        let title: string;
        let message: string;

        if (daysUntilDue === 0) {
          title = 'Assignment Due Today';
          message = `Your assignment "${assignment.title}" for ${assignment.module.moduleName} is due today. Submit before the deadline!`;
        } else if (daysUntilDue === 1) {
          title = 'Assignment Due Tomorrow';
          message = `Your assignment "${assignment.title}" for ${assignment.module.moduleName} is due tomorrow. Make sure to submit on time!`;
        } else {
          title = 'Assignment Deadline Reminder';
          message = `Your assignment "${assignment.title}" for ${assignment.module.moduleName} is due in ${daysUntilDue} days. Plan ahead and submit before the deadline.`;
        }

        for (const enrollment of enrollments) {
          if (!enrollment.student?.user) continue;

          // Skip students who already submitted
          if (submittedStudentIds.has(enrollment.student.id)) continue;

          try {
            await notificationService.createNotification({
              userId: enrollment.student.user.id,
              title,
              message,
              type: NotificationType.ASSIGNMENT,
              link: '/student/assignments',
              sendEmail: true,
            });
            remindersSent++;
          } catch (error) {
            console.error(`Failed to send assignment reminder to student ${enrollment.student.id}:`, error);
          }
        }
      }

      console.log(`📝 Assignment reminder complete: ${upcomingAssignments.length} upcoming assignment(s), ${remindersSent} reminders sent.`);
    } catch (error) {
      console.error('Error in assignment reminder service:', error);
    }
  }
}

export default new AssignmentReminderService();
