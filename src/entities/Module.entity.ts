import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Assignment } from "./Assignment.entity";
import { Feedback } from "./Feedback.entity";
import { LectureNote } from "./LectureNote.entity";
import { Lecturer } from "./Lecturer.entity";
import { Program } from "./Program.entity";
import { Result } from "./Result.entity";
import { Schedule } from "./Schedule.entity";

@Entity()
export class Module {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  moduleCode: string;

  @Column({ type: 'varchar', length: 200 })
  moduleName: string;

  @Column({ type: 'int' })
  semesterNumber: number;

  @Column({ type: 'int', nullable: true })
  credits: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @ManyToOne(() => Program, program => program.modules)
  program: Program;

  @ManyToOne(() => Lecturer, lecturer => lecturer.modules)
  lecturer: Lecturer;

  @OneToMany(() => Schedule, schedule => schedule.module)
  schedules: Schedule[];

  @OneToMany(() => Assignment, assignment => assignment.module)
  assignments: Assignment[];

  @OneToMany(() => Result, result => result.module)
  results: Result[];

  @OneToMany(() => Feedback, feedback => feedback.module)
  feedbacks: Feedback[];

  @OneToMany(() => LectureNote, note => note.module)
  lectureNotes: LectureNote[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
