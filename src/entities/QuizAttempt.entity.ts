import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn } from "typeorm";
import { Quiz } from "./Quiz.entity";
import { Student } from "./Student.entity";
import { QuizAnswer } from "./QuizAnswer.entity";

@Entity('quiz_attempts')
export class QuizAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Quiz, quiz => quiz.attempts)
  quiz: Quiz;

  @ManyToOne(() => Student)
  student: Student;

  @CreateDateColumn()
  startTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  submittedTime: Date;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  score: number;

  @Column({ type: 'varchar', length: 20, default: 'IN_PROGRESS' })
  status: string; // 'IN_PROGRESS', 'SUBMITTED', 'TIMED_OUT', 'CANCELLED'

  @Column({ type: 'text', nullable: true })
  reason: string;

  @OneToMany(() => QuizAnswer, answer => answer.attempt)
  answers: QuizAnswer[];
}
