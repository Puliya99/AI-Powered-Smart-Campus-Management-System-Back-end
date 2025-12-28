import { ResultStatus } from '../enums/ResultStatus.enum';
import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Student } from "./Student.entity";
import { Module } from "./Module.entity";

@Entity()
export class Result {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Student, student => student.results)
  student: Student;

  @ManyToOne(() => Module, module => module.results)
  module: Module;

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
