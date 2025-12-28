import { SubmissionStatus } from '../enums/SubmissionStatus.enum';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Student } from "./Student.entity";
import { Module } from "./Module.entity";

@Entity()
export class Assignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  assignmentName: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @ManyToOne(() => Module, module => module.assignments)
  module: Module;

  @ManyToOne(() => Student, student => student.assignments)
  student: Student;

  @Column({ type: 'date' })
  dueDate: Date;

  @Column({ type: 'date', nullable: true })
  submittedDate: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  submissionFile: string;

  @Column({ type: 'enum', enum: SubmissionStatus, default: SubmissionStatus.NOT_SUBMITTED })
  submissionStatus: SubmissionStatus;

  @Column({ type: 'int', nullable: true })
  marks: number;

  @Column({ type: 'int', nullable: true })
  maxMarks: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
