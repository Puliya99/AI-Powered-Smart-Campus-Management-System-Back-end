import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToMany, JoinTable, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Lecturer } from "./Lecturer.entity";
import { Schedule } from "./Schedule.entity";
import { User } from "./User.entity";
import { Program } from "./Program.entity";
import { Batch } from "./Batch.entity";

@Entity()
export class Center {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  centerCode: string;

  @Column({ type: 'varchar', length: 200 })
  centerName: string;

  @Column({ type: 'varchar', length: 200 })
  branch: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'varchar', length: 15, nullable: true })
  phone: string;

  @OneToMany(() => User, user => user.center)
  users: User[];

  @ManyToMany(() => Lecturer, lecturer => lecturer.centers)
  @JoinTable()
  lecturers: Lecturer[];

  @ManyToMany(() => Program, program => program.centers)
  programs: Program[];

  @ManyToMany(() => Batch, batch => batch.centers)
  batches: Batch[];

  @OneToMany(() => Schedule, schedule => schedule.center)
  schedules: Schedule[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
