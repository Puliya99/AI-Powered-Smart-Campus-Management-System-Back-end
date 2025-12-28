import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Student } from "./Student.entity";
import { Module } from "./Module.entity";

@Entity()
export class Feedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Student, student => student.feedbacks)
  student: Student;

  @ManyToOne(() => Module, module => module.feedbacks)
  module: Module;

  @Column({ type: 'int', nullable: true })
  rating: number; // 1-5

  @Column({ type: 'text' })
  comment: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  sentiment: string; // POSITIVE, NEGATIVE, NEUTRAL (from AI)

  @Column({ type: 'date' })
  feedbackDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
