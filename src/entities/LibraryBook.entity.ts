import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BookCategory } from '../enums/BookCategory.enum';
import { Borrowing } from './Borrowing.entity';

@Entity()
export class LibraryBook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 300 })
  title: string;

  @Column({ type: 'varchar', length: 200 })
  author: string;

  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  isbn: string;

  @Column({ type: 'enum', enum: BookCategory, default: BookCategory.OTHER })
  category: BookCategory;

  @Column({ type: 'int', default: 1 })
  totalCopies: number;

  @Column({ type: 'int', default: 1 })
  availableCopies: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  shelfLocation: string;

  @OneToMany(() => Borrowing, borrowing => borrowing.book)
  borrowings: Borrowing[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
