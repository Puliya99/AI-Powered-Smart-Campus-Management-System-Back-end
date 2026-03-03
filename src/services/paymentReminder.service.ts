import { AppDataSource } from '../config/database';
import { Payment } from '../entities/Payment.entity';
import { PaymentStatus } from '../enums/PaymentStatus.enum';
import { NotificationType } from '../enums/NotificationType.enum';
import { LessThanOrEqual } from 'typeorm';
import notificationService from './notification.service';

export class PaymentReminderService {
  private intervalId: NodeJS.Timeout | null = null;

  public start() {
    console.log('💳 Payment Reminder Service started.');

    // Run once on start with a delay to allow DB to initialize
    setTimeout(() => {
      this.checkAndRemind();
    }, 20000);

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
    console.log('🛑 Payment Reminder Service stopped.');
  }

  private async checkAndRemind() {
    try {
      console.log('💳 Running payment reminder check...');

      const paymentRepository = AppDataSource.getRepository(Payment);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Remind for payments due within 3 days or already overdue
      const threeDaysFromNow = new Date(today);
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

      const pendingPayments = await paymentRepository.find({
        where: {
          status: PaymentStatus.PENDING,
          nextPaymentDate: LessThanOrEqual(threeDaysFromNow),
        },
        relations: ['student', 'student.user', 'program'],
      });

      let remindersSent = 0;

      for (const payment of pendingPayments) {
        if (!payment.nextPaymentDate || !payment.student?.user) continue;

        const dueDate = new Date(payment.nextPaymentDate);
        dueDate.setHours(0, 0, 0, 0);
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const amount = `$${Number(payment.outstanding).toFixed(2)}`;
        const programName = (payment.program as any)?.programName || (payment.program as any)?.name || 'your program';

        let title: string;
        let message: string;

        if (daysUntilDue < 0) {
          const daysOverdue = Math.abs(daysUntilDue);
          title = 'Overdue Payment Reminder';
          message = `Your payment of ${amount} for ${programName} is ${daysOverdue} day(s) overdue. Please make your payment immediately to avoid penalties.`;
        } else if (daysUntilDue === 0) {
          title = 'Payment Due Today';
          message = `Your payment of ${amount} for ${programName} is due today. Please make your payment to avoid a late fee.`;
        } else {
          title = 'Upcoming Payment Reminder';
          message = `Your payment of ${amount} for ${programName} is due in ${daysUntilDue} day(s). Please prepare your payment.`;
        }

        try {
          await notificationService.createNotification({
            userId: payment.student.user.id,
            title,
            message,
            type: NotificationType.PAYMENT,
            link: '/student/payments',
            sendEmail: true,
          });
          remindersSent++;
        } catch (error) {
          console.error(`Failed to send payment reminder to student ${payment.student.id}:`, error);
        }
      }

      console.log(`💳 Payment reminder complete: ${pendingPayments.length} pending payment(s), ${remindersSent} reminders sent.`);
    } catch (error) {
      console.error('Error in payment reminder service:', error);
    }
  }
}

export default new PaymentReminderService();
