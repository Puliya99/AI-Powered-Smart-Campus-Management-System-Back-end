import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany } from "typeorm";
import { Quiz } from "./Quiz.entity";
import { QuizAnswer } from "./QuizAnswer.entity";

@Entity('quiz_questions')
export class QuizQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Quiz, quiz => quiz.questions, { onDelete: 'CASCADE' })
  quiz: Quiz;

  @Column({ type: 'text' })
  questionText: string;

  @Column({ type: 'varchar', length: 500 })
  optionA: string;

  @Column({ type: 'varchar', length: 500 })
  optionB: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  optionC: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  optionD: string;

  @Column({ type: 'varchar', length: 1 })
  correctOption: string; // 'A', 'B', 'C', or 'D'

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 1 })
  marks: number;

  @OneToMany(() => QuizAnswer, answer => answer.question)
  answers: QuizAnswer[];
}
