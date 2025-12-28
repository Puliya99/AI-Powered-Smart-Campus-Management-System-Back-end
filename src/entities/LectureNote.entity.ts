import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Lecturer } from "./Lecturer.entity";
import { Module } from "./Module.entity";

@Entity()
export class LectureNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Lecturer, lecturer => lecturer.lectureNotes)
  lecturer: Lecturer;

  @ManyToOne(() => Module, module => module.lectureNotes)
  module: Module;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  fileUrl: string;

  @Column({ type: 'date' })
  uploadDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
