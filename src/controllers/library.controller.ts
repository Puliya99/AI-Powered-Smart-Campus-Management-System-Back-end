import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { LibraryBook } from '../entities/LibraryBook.entity';
import { Borrowing } from '../entities/Borrowing.entity';
import { User } from '../entities/User.entity';
import { BookCategory } from '../enums/BookCategory.enum';
import { BorrowingStatus } from '../enums/BorrowingStatus.enum';
import { Role } from '../enums/Role.enum';
import { NotificationType } from '../enums/NotificationType.enum';
import notificationService from '../services/notification.service';
import { In, LessThan } from 'typeorm';

export class LibraryController {
  private bookRepository = AppDataSource.getRepository(LibraryBook);
  private borrowingRepository = AppDataSource.getRepository(Borrowing);
  private userRepository = AppDataSource.getRepository(User);

  // ==================== BOOK MANAGEMENT ====================

  async getAllBooks(req: Request, res: Response) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        category = '',
        sortBy = 'title',
        sortOrder = 'ASC',
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      const queryBuilder = this.bookRepository
        .createQueryBuilder('book')
        .loadRelationCountAndMap('book.activeBorrowings', 'book.borrowings', 'borrowing', qb =>
          qb.where('borrowing.status IN (:...statuses)', { statuses: [BorrowingStatus.BORROWED, BorrowingStatus.OVERDUE] })
        )
        .skip(skip)
        .take(Number(limit))
        .orderBy(`book.${sortBy}`, sortOrder as 'ASC' | 'DESC');

      if (search) {
        queryBuilder.where(
          '(book.title ILIKE :search OR book.author ILIKE :search OR book.isbn ILIKE :search)',
          { search: `%${search}%` }
        );
      }

      if (category) {
        queryBuilder.andWhere('book.category = :category', { category });
      }

      const [books, total] = await queryBuilder.getManyAndCount();

      res.json({
        status: 'success',
        data: {
          books,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to fetch books' });
    }
  }

  async getBookById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const book = await this.bookRepository.findOne({
        where: { id },
        relations: ['borrowings', 'borrowings.borrower'],
      });

      if (!book) {
        return res.status(404).json({ status: 'error', message: 'Book not found' });
      }

      res.json({ status: 'success', data: { book } });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to fetch book' });
    }
  }

  async createBook(req: Request, res: Response) {
    try {
      const { title, author, isbn, category, totalCopies, shelfLocation } = req.body;

      if (!title || !author) {
        return res.status(400).json({ status: 'error', message: 'Title and author are required' });
      }

      if (isbn) {
        const existing = await this.bookRepository.findOne({ where: { isbn } });
        if (existing) {
          return res.status(400).json({ status: 'error', message: 'A book with this ISBN already exists' });
        }
      }

      const copies = totalCopies ? Number(totalCopies) : 1;

      const book = this.bookRepository.create({
        title,
        author,
        isbn: isbn || null,
        category: category || BookCategory.OTHER,
        totalCopies: copies,
        availableCopies: copies,
        shelfLocation: shelfLocation || null,
      });

      await this.bookRepository.save(book);

      res.status(201).json({
        status: 'success',
        message: 'Book added successfully',
        data: { book },
      });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message || 'Failed to add book' });
    }
  }

  async updateBook(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { title, author, isbn, category, totalCopies, shelfLocation } = req.body;

      const book = await this.bookRepository.findOne({ where: { id } });
      if (!book) {
        return res.status(404).json({ status: 'error', message: 'Book not found' });
      }

      if (isbn && isbn !== book.isbn) {
        const existing = await this.bookRepository.findOne({ where: { isbn } });
        if (existing) {
          return res.status(400).json({ status: 'error', message: 'A book with this ISBN already exists' });
        }
      }

      if (title) book.title = title;
      if (author) book.author = author;
      if (isbn !== undefined) book.isbn = isbn || null;
      if (category) book.category = category;
      if (shelfLocation !== undefined) book.shelfLocation = shelfLocation || null;

      if (totalCopies !== undefined) {
        const newTotal = Number(totalCopies);
        const borrowedCount = book.totalCopies - book.availableCopies;
        if (newTotal < borrowedCount) {
          return res.status(400).json({
            status: 'error',
            message: `Cannot reduce total copies below ${borrowedCount} (currently borrowed)`,
          });
        }
        book.availableCopies = newTotal - borrowedCount;
        book.totalCopies = newTotal;
      }

      await this.bookRepository.save(book);

      res.json({
        status: 'success',
        message: 'Book updated successfully',
        data: { book },
      });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message || 'Failed to update book' });
    }
  }

  async deleteBook(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const book = await this.bookRepository.findOne({ where: { id } });
      if (!book) {
        return res.status(404).json({ status: 'error', message: 'Book not found' });
      }

      const activeBorrowings = await this.borrowingRepository.count({
        where: {
          book: { id },
          status: In([BorrowingStatus.BORROWED, BorrowingStatus.OVERDUE]),
        },
      });

      if (activeBorrowings > 0) {
        return res.status(400).json({
          status: 'error',
          message: `Cannot delete book with ${activeBorrowings} active borrowing(s)`,
        });
      }

      await this.bookRepository.remove(book);

      res.json({ status: 'success', message: 'Book deleted successfully' });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message || 'Failed to delete book' });
    }
  }

  async getBookStats(req: Request, res: Response) {
    try {
      const totalBooks = await this.bookRepository.count();

      const totalCopiesResult = await this.bookRepository
        .createQueryBuilder('book')
        .select('SUM(book.totalCopies)', 'total')
        .addSelect('SUM(book.availableCopies)', 'available')
        .getRawOne();

      const borrowedCount = await this.borrowingRepository.count({
        where: { status: BorrowingStatus.BORROWED },
      });

      const overdueCount = await this.borrowingRepository.count({
        where: { status: BorrowingStatus.OVERDUE },
      });

      const totalFinesResult = await this.borrowingRepository
        .createQueryBuilder('borrowing')
        .select('SUM(borrowing.fineAmount)', 'totalFines')
        .where('borrowing.fineAmount > 0')
        .getRawOne();

      res.json({
        status: 'success',
        data: {
          totalBooks,
          totalCopies: Number(totalCopiesResult?.total) || 0,
          availableCopies: Number(totalCopiesResult?.available) || 0,
          borrowedCount,
          overdueCount,
          totalFines: Number(totalFinesResult?.totalFines) || 0,
        },
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to fetch stats' });
    }
  }

  async getBooksDropdown(req: Request, res: Response) {
    try {
      const books = await this.bookRepository
        .createQueryBuilder('book')
        .where('book.availableCopies > 0')
        .select(['book.id', 'book.title', 'book.author', 'book.isbn', 'book.availableCopies'])
        .orderBy('book.title', 'ASC')
        .getMany();

      res.json({ status: 'success', data: { books } });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to fetch books dropdown' });
    }
  }

  // ==================== BORROWING MANAGEMENT ====================

  async getAllBorrowings(req: Request, res: Response) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        status = '',
        sortBy = 'borrowDate',
        sortOrder = 'DESC',
      } = req.query;

      // Auto-update overdue statuses
      await this.updateOverdueStatuses();

      const skip = (Number(page) - 1) * Number(limit);

      const queryBuilder = this.borrowingRepository
        .createQueryBuilder('borrowing')
        .leftJoinAndSelect('borrowing.book', 'book')
        .leftJoinAndSelect('borrowing.borrower', 'borrower')
        .skip(skip)
        .take(Number(limit))
        .orderBy(`borrowing.${sortBy}`, sortOrder as 'ASC' | 'DESC');

      if (search) {
        queryBuilder.where(
          '(book.title ILIKE :search OR borrower.firstName ILIKE :search OR borrower.lastName ILIKE :search OR borrower.email ILIKE :search)',
          { search: `%${search}%` }
        );
      }

      if (status) {
        queryBuilder.andWhere('borrowing.status = :status', { status });
      }

      const [borrowings, total] = await queryBuilder.getManyAndCount();

      res.json({
        status: 'success',
        data: {
          borrowings,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to fetch borrowings' });
    }
  }

  async createBorrowing(req: Request, res: Response) {
    try {
      const { bookId, borrowerId, dueDate, finePerDay = 0, notes } = req.body;

      if (!bookId || !borrowerId || !dueDate) {
        return res.status(400).json({ status: 'error', message: 'Book, borrower, and due date are required' });
      }

      const book = await this.bookRepository.findOne({ where: { id: bookId } });
      if (!book) {
        return res.status(404).json({ status: 'error', message: 'Book not found' });
      }

      if (book.availableCopies <= 0) {
        return res.status(400).json({ status: 'error', message: 'No copies available for this book' });
      }

      const borrower = await this.userRepository.findOne({ where: { id: borrowerId } });
      if (!borrower) {
        return res.status(404).json({ status: 'error', message: 'Borrower not found' });
      }

      if (![Role.STUDENT, Role.LECTURER].includes(borrower.role)) {
        return res.status(400).json({ status: 'error', message: 'Only students and lecturers can borrow books' });
      }

      // Check if borrower already has this book
      const existingBorrow = await this.borrowingRepository.findOne({
        where: {
          book: { id: bookId },
          borrower: { id: borrowerId },
          status: In([BorrowingStatus.BORROWED, BorrowingStatus.OVERDUE]),
        },
      });

      if (existingBorrow) {
        return res.status(400).json({ status: 'error', message: 'Borrower already has an active borrowing for this book' });
      }

      const borrowing = this.borrowingRepository.create({
        book,
        borrower,
        borrowDate: new Date(),
        dueDate: new Date(dueDate),
        status: BorrowingStatus.BORROWED,
        finePerDay: Number(finePerDay),
        fineAmount: 0,
        notes: notes || null,
      });

      await this.borrowingRepository.save(borrowing);

      // Decrease available copies
      book.availableCopies -= 1;
      await this.bookRepository.save(book);

      // Notify borrower
      try {
        const dueDateStr = new Date(dueDate).toLocaleDateString();
        await notificationService.createNotification({
          userId: borrower.id,
          title: 'Book Borrowed',
          message: `You have borrowed "${book.title}". Please return it by ${dueDateStr}.`,
          type: NotificationType.LIBRARY,
          link: borrower.role === Role.STUDENT ? '/student/library' : '/lecturer/library',
          sendEmail: true,
        });
      } catch (notifyError) {
        console.error('Failed to send borrowing notification:', notifyError);
      }

      const completeBorrowing = await this.borrowingRepository.findOne({
        where: { id: borrowing.id },
        relations: ['book', 'borrower'],
      });

      res.status(201).json({
        status: 'success',
        message: 'Book borrowed successfully',
        data: { borrowing: completeBorrowing },
      });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message || 'Failed to create borrowing' });
    }
  }

  async returnBook(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const borrowing = await this.borrowingRepository.findOne({
        where: { id },
        relations: ['book', 'borrower'],
      });

      if (!borrowing) {
        return res.status(404).json({ status: 'error', message: 'Borrowing not found' });
      }

      if (borrowing.status === BorrowingStatus.RETURNED) {
        return res.status(400).json({ status: 'error', message: 'Book has already been returned' });
      }

      // Calculate final fine
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(borrowing.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      if (today > dueDate && Number(borrowing.finePerDay) > 0) {
        const daysOverdue = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        borrowing.fineAmount = daysOverdue * Number(borrowing.finePerDay);
      }

      borrowing.status = BorrowingStatus.RETURNED;
      borrowing.returnDate = new Date();
      await this.borrowingRepository.save(borrowing);

      // Increase available copies
      borrowing.book.availableCopies += 1;
      await this.bookRepository.save(borrowing.book);

      // Notify borrower
      try {
        const fineMsg = Number(borrowing.fineAmount) > 0
          ? ` You have a fine of $${Number(borrowing.fineAmount).toFixed(2)}.`
          : '';
        await notificationService.createNotification({
          userId: borrowing.borrower.id,
          title: 'Book Returned',
          message: `"${borrowing.book.title}" has been marked as returned.${fineMsg}`,
          type: NotificationType.LIBRARY,
          link: borrowing.borrower.role === Role.STUDENT ? '/student/library' : '/lecturer/library',
          sendEmail: true,
        });
      } catch (notifyError) {
        console.error('Failed to send return notification:', notifyError);
      }

      res.json({
        status: 'success',
        message: 'Book returned successfully',
        data: { borrowing },
      });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message || 'Failed to return book' });
    }
  }

  async getBorrowingStats(req: Request, res: Response) {
    try {
      await this.updateOverdueStatuses();

      const activeBorrowings = await this.borrowingRepository.count({
        where: { status: BorrowingStatus.BORROWED },
      });

      const overdueCount = await this.borrowingRepository.count({
        where: { status: BorrowingStatus.OVERDUE },
      });

      const returnedCount = await this.borrowingRepository.count({
        where: { status: BorrowingStatus.RETURNED },
      });

      const totalFinesResult = await this.borrowingRepository
        .createQueryBuilder('borrowing')
        .select('SUM(borrowing.fineAmount)', 'totalFines')
        .where('borrowing.fineAmount > 0')
        .getRawOne();

      res.json({
        status: 'success',
        data: {
          activeBorrowings,
          overdueCount,
          returnedCount,
          totalFines: Number(totalFinesResult?.totalFines) || 0,
        },
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to fetch borrowing stats' });
    }
  }

  // ==================== STUDENT/LECTURER ENDPOINT ====================

  async getMyBorrowings(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;

      await this.updateOverdueStatuses();

      const borrowings = await this.borrowingRepository.find({
        where: { borrower: { id: userId } },
        relations: ['book'],
        order: { borrowDate: 'DESC' },
      });

      const stats = {
        currentlyBorrowed: borrowings.filter(b => b.status === BorrowingStatus.BORROWED).length,
        overdue: borrowings.filter(b => b.status === BorrowingStatus.OVERDUE).length,
        totalFines: borrowings.reduce((sum, b) => sum + Number(b.fineAmount), 0),
      };

      res.json({
        status: 'success',
        data: { borrowings, stats },
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to fetch borrowings' });
    }
  }

  // ==================== HELPERS ====================

  async getUsersDropdown(req: Request, res: Response) {
    try {
      const users = await this.userRepository.find({
        where: { role: In([Role.STUDENT, Role.LECTURER]), isActive: true },
        select: ['id', 'firstName', 'lastName', 'email', 'role'],
        order: { firstName: 'ASC' },
      });

      res.json({ status: 'success', data: { users } });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to fetch users' });
    }
  }

  private async updateOverdueStatuses() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const overdueBorrowings = await this.borrowingRepository.find({
        where: {
          status: BorrowingStatus.BORROWED,
          dueDate: LessThan(today),
        },
      });

      for (const borrowing of overdueBorrowings) {
        borrowing.status = BorrowingStatus.OVERDUE;
        const dueDate = new Date(borrowing.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const daysOverdue = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        borrowing.fineAmount = daysOverdue * Number(borrowing.finePerDay);
      }

      if (overdueBorrowings.length > 0) {
        await this.borrowingRepository.save(overdueBorrowings);
      }
    } catch (error) {
      console.error('Error updating overdue statuses:', error);
    }
  }
}

export default new LibraryController();
