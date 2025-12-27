import { EnrollmentStatus } from '../enums/EnrollmentStatus.enum';
import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Program } from "./Program.entity";
import { Student } from "./Student.entity";
import { Batch } from "./Batch.entity";

@Entity()
export class Enrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Student, student => student.enrollments)
  student: Student;

  @ManyToOne(() => Program, program => program.enrollments)
  program: Program;

  @ManyToOne(() => Batch, batch => batch.enrollments)
  batch: Batch;

  @Column({ type: 'date' })
  enrollmentDate: Date;

  @Column({ type: 'enum', enum: EnrollmentStatus, default: EnrollmentStatus.ACTIVE })
  status: EnrollmentStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
