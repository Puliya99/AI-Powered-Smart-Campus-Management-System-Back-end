import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { PaymentMethod } from '../enums/PaymentMethod.enum';
import { PaymentStatus } from '../enums/PaymentStatus.enum';
import { Program } from './Program.entity';
import { Student } from './Student.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Student, student => student.payments)
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @ManyToOne(() => Program, program => program.payments)
  @JoinColumn({ name: 'program_id' })
  program: Program;

  @Column({ type: 'date' })
  paymentDate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @Column({ type: 'varchar', length: 100, nullable: true })
  transactionId: string;

  @Column({ type: 'date', nullable: true })
  nextPaymentDate: Date | null;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  outstanding: number;

  @Column({ type: 'enum', enum: PaymentStatus })
  status: PaymentStatus;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
