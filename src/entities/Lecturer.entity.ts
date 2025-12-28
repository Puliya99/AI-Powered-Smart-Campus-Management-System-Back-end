import { Entity, PrimaryGeneratedColumn, OneToOne, JoinColumn, Column, OneToMany, ManyToMany, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Center } from "./Center.entity";
import { LectureNote } from "./LectureNote.entity";
import { Schedule } from "./Schedule.entity";
import { User } from "./User.entity";
import { Module } from "./Module.entity";

@Entity()
export class Lecturer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User)
  @JoinColumn()
  user: User;

  @Column({ type: 'varchar', length: 100, nullable: true })
  specialization: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  qualification: string;

  @OneToMany(() => Module, module => module.lecturer)
  modules: Module[];

  @OneToMany(() => Schedule, schedule => schedule.lecturer)
  schedules: Schedule[];

  @OneToMany(() => LectureNote, note => note.lecturer)
  lectureNotes: LectureNote[];

  @ManyToMany(() => Center, center => center.lecturers)
  centers: Center[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
