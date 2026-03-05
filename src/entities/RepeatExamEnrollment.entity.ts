import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Student } from './Student.entity';
import { Module } from './Module.entity';
import { Batch } from './Batch.entity';

export enum RepeatExamStatus {
  PENDING   = 'PENDING',   // registered, not yet notified
  NOTIFIED  = 'NOTIFIED',  // student has been notified about the next exam
  COMPLETED = 'COMPLETED', // student sat the repeat exam
  CANCELLED = 'CANCELLED', // cancelled (e.g. student passed via another path)
}

@Entity('repeat_exam_enrollments')
export class RepeatExamEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Student, { eager: false })
  student: Student;

  @ManyToOne(() => Module, { eager: false })
  module: Module;

  /** The batch in which the student originally failed */
  @ManyToOne(() => Batch, { nullable: true, eager: false })
  originalBatch: Batch | null;

  /** The next batch whose exam the student will sit */
  @ManyToOne(() => Batch, { nullable: true, eager: false })
  nextBatch: Batch | null;

  @Column({ type: 'enum', enum: RepeatExamStatus, default: RepeatExamStatus.PENDING })
  status: RepeatExamStatus;

  /** Has the student paid the repeat exam fee? */
  @Column({ type: 'boolean', default: false })
  hasPaid: boolean;

  /** Repeat exam fee amount (LKR) – null means fee not yet assessed */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  repeatFee: number | null;

  /** Timestamp when the notification was sent */
  @Column({ type: 'timestamp', nullable: true })
  notifiedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
