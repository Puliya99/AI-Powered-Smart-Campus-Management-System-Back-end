import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { QuizAttempt } from "./QuizAttempt.entity";
import { QuizQuestion } from "./QuizQuestion.entity";

@Entity('quiz_answers')
export class QuizAnswer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => QuizAttempt, attempt => attempt.answers, { onDelete: 'CASCADE' })
  attempt: QuizAttempt;

  @ManyToOne(() => QuizQuestion)
  question: QuizQuestion;

  @Column({ type: 'varchar', length: 1, nullable: true })
  selectedOption: string;

  @Column({ type: 'boolean', default: false })
  isCorrect: boolean;
}
