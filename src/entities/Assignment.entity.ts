import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Module } from "./Module.entity";
import { Lecturer } from "./Lecturer.entity";
import { Submission } from "./Submission.entity";

@Entity('assignments')
export class Assignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @ManyToOne(() => Module, module => module.assignments)
  module: Module;

  @ManyToOne(() => Lecturer)
  lecturer: Lecturer;

  @Column({ type: 'timestamp' })
  dueDate: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  fileUrl: string;

  @OneToMany(() => Submission, submission => submission.assignment)
  submissions: Submission[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
