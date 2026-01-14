import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Assignment } from "./Assignment.entity";
import { Student } from "./Student.entity";
import { SubmissionStatus } from "../enums/SubmissionStatus.enum";

@Entity('submissions')
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Assignment, assignment => assignment.submissions, { onDelete: 'CASCADE' })
  assignment: Assignment;

  @ManyToOne(() => Student)
  student: Student;

  @Column({ type: 'varchar', length: 500 })
  fileUrl: string;

  @Column({ type: 'timestamp' })
  submittedAt: Date;

  @Column({
    type: 'enum',
    enum: SubmissionStatus,
    default: SubmissionStatus.SUBMITTED
  })
  status: SubmissionStatus;

  @Column({ type: 'boolean', default: false })
  isLate: boolean;

  @Column({ type: 'text', nullable: true })
  feedback: string;

  @Column({ type: 'int', nullable: true })
  marks: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}