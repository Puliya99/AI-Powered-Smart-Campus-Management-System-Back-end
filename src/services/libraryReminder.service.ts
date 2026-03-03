import { AppDataSource } from '../config/database';
import { Borrowing } from '../entities/Borrowing.entity';
import { BorrowingStatus } from '../enums/BorrowingStatus.enum';
import { NotificationType } from '../enums/NotificationType.enum';
import { Role } from '../enums/Role.enum';
import { LessThanOrEqual, In } from 'typeorm';
import notificationService from './notification.service';

export class LibraryReminderService {
  private intervalId: NodeJS.Timeout | null = null;

  public start() {
    console.log('📚 Library Reminder Service started.');

    // Run once on start (with a small delay to let DB initialize)
    setTimeout(() => {
      this.checkOverdueAndRemind();
    }, 10000);

    // Run daily (24 hours)
    const ONE_DAY = 24 * 60 * 60 * 1000;
    this.intervalId = setInterval(() => {
      this.checkOverdueAndRemind();
    }, ONE_DAY);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('🛑 Library Reminder Service stopped.');
  }

  private async checkOverdueAndRemind() {
    try {
      console.log('📚 Running library overdue check...');
      const borrowingRepository = AppDataSource.getRepository(Borrowing);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 1. Update BORROWED items that are past due to OVERDUE and calculate fines
      const newlyOverdue = await borrowingRepository.find({
        where: {
          status: BorrowingStatus.BORROWED,
          dueDate: LessThanOrEqual(today),
        },
        relations: ['book', 'borrower'],
      });

      for (const borrowing of newlyOverdue) {
        const dueDate = new Date(borrowing.dueDate);
        dueDate.setHours(0, 0, 0, 0);

        if (today > dueDate) {
          borrowing.status = BorrowingStatus.OVERDUE;
          const daysOverdue = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          borrowing.fineAmount = daysOverdue * Number(borrowing.finePerDay);
        }
      }

      if (newlyOverdue.length > 0) {
        await borrowingRepository.save(newlyOverdue);
      }

      // 2. Get ALL currently overdue borrowings for reminders
      const allOverdue = await borrowingRepository.find({
        where: { status: BorrowingStatus.OVERDUE },
        relations: ['book', 'borrower'],
      });

      // Update fines for all overdue
      for (const borrowing of allOverdue) {
        const dueDate = new Date(borrowing.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const daysOverdue = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        borrowing.fineAmount = daysOverdue * Number(borrowing.finePerDay);
      }

      if (allOverdue.length > 0) {
        await borrowingRepository.save(allOverdue);
      }

      // 3. Group overdue by user and send reminders
      const userOverdueMap = new Map<string, { user: any; books: { title: string; daysOverdue: number; fine: number }[] }>();

      for (const borrowing of allOverdue) {
        const userId = borrowing.borrower.id;
        if (!userOverdueMap.has(userId)) {
          userOverdueMap.set(userId, { user: borrowing.borrower, books: [] });
        }
        const dueDate = new Date(borrowing.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const daysOverdue = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        userOverdueMap.get(userId)!.books.push({
          title: borrowing.book.title,
          daysOverdue,
          fine: Number(borrowing.fineAmount),
        });
      }

      let remindersSent = 0;
      for (const [userId, data] of userOverdueMap) {
        try {
          const bookList = data.books.map(b => `"${b.title}" (${b.daysOverdue} day(s) overdue, fine: $${b.fine.toFixed(2)})`).join(', ');
          const totalFine = data.books.reduce((sum, b) => sum + b.fine, 0);
          const link = data.user.role === Role.STUDENT ? '/student/library' : '/lecturer/library';

          await notificationService.createNotification({
            userId,
            title: 'Overdue Book Reminder',
            message: `You have ${data.books.length} overdue book(s): ${bookList}. Total fine: $${totalFine.toFixed(2)}. Please return them as soon as possible.`,
            type: NotificationType.LIBRARY,
            link,
            sendEmail: true,
          });
          remindersSent++;
        } catch (error) {
          console.error(`Failed to send overdue reminder to user ${userId}:`, error);
        }
      }

      // 4. Send due-today reminders (books due today that haven't been returned)
      const dueToday = await borrowingRepository.find({
        where: {
          status: BorrowingStatus.BORROWED,
        },
        relations: ['book', 'borrower'],
      });

      const dueTodayItems = dueToday.filter(b => {
        const dueDate = new Date(b.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate.getTime() === today.getTime();
      });

      for (const borrowing of dueTodayItems) {
        try {
          const link = borrowing.borrower.role === Role.STUDENT ? '/student/library' : '/lecturer/library';
          await notificationService.createNotification({
            userId: borrowing.borrower.id,
            title: 'Book Due Today',
            message: `Your borrowed book "${borrowing.book.title}" is due today. Please return it to avoid fines.`,
            type: NotificationType.LIBRARY,
            link,
            sendEmail: true,
          });
          remindersSent++;
        } catch (error) {
          console.error(`Failed to send due-today reminder:`, error);
        }
      }

      console.log(`📚 Library check complete: ${allOverdue.length} overdue, ${dueTodayItems.length} due today, ${remindersSent} reminders sent.`);
    } catch (error) {
      console.error('Error in library overdue check:', error);
    }
  }
}

export default new LibraryReminderService();
