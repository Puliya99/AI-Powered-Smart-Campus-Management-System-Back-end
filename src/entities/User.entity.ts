import { Gender } from '../enums/Gender.enum';
import { Role } from '../enums/Role.enum';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Center } from "./Center.entity";

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  username: string;

  @Column({ type: 'varchar', length: 255 })
  password: string; // Hashed

  @Column({ type: 'varchar', length: 100, unique: true })
  email: string;

  @Column({ type: 'enum', enum: Role })
  role: Role;

  @Column({ type: 'varchar', length: 50 })
  title: string; // Mr, Ms, Dr, Prof

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Column({ type: 'varchar', length: 150 })
  nameWithInitials: string;

  @Column({ type: 'enum', enum: Gender })
  gender: Gender;

  @Column({ type: 'date' })
  dateOfBirth: Date;

  @Column({ type: 'varchar', length: 20, unique: true })
  nic: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'varchar', length: 15 })
  mobileNumber: string;

  @Column({ type: 'varchar', length: 15, nullable: true })
  homeNumber: string;

  @Column({ type: 'varchar', nullable: true })
  profilePic: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  registrationNumber: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToOne(() => Center, center => center.users)
  center: Center;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
