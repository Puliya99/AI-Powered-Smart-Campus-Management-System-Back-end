import { ResultStatus } from '../enums/ResultStatus.enum';
import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Student } from "./Student.entity";
import { Module } from "./Module.entity";
import { Batch } from "./Batch.entity";

@Entity()
export class Result {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Student, student => student.results)
  student: Student;

  @ManyToOne(() => Module, module => module.results)
  module: Module;

  /** Which batch's exam sitting this result belongs to */
  @ManyToOne(() => Batch, { nullable: true, eager: false })
  batch: Batch | null;

  @Column({ type: 'int' })
  marks: number;

  @Column({ type: 'int' })
  maxMarks: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  grade: string; // A+, A, B+, etc.

  @Column({ type: 'enum', enum: ResultStatus })
  status: ResultStatus;

  @Column({ type: 'date' })
  examDate: Date;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  /** Which attempt number this is (1 = first sit, 2+ = repeat) */
  @Column({ type: 'int', default: 1 })
  attemptNumber: number;

  /** true if this result is from a repeat/resit sitting */
  @Column({ type: 'boolean', default: false })
  isRepeat: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
