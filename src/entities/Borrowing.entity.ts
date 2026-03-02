import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BorrowingStatus } from '../enums/BorrowingStatus.enum';
import { LibraryBook } from './LibraryBook.entity';
import { User } from './User.entity';

@Entity()
export class Borrowing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LibraryBook, book => book.borrowings)
  book: LibraryBook;

  @ManyToOne(() => User)
  borrower: User;

  @Column({ type: 'date' })
  borrowDate: Date;

  @Column({ type: 'date' })
  dueDate: Date;

  @Column({ type: 'date', nullable: true })
  returnDate: Date;

  @Column({ type: 'enum', enum: BorrowingStatus, default: BorrowingStatus.BORROWED })
  status: BorrowingStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  fineAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  finePerDay: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
