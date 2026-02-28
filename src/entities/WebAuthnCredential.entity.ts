import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Student } from "./Student.entity";

@Entity()
export class WebAuthnCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Student, student => student.webauthnCredentials, { onDelete: 'CASCADE' })
  student: Student;

  // Base64url-encoded credential ID from WebAuthn registration
  @Column({ type: 'text', unique: true })
  credentialId: string;

  // Base64url-encoded public key
  @Column({ type: 'text' })
  credentialPublicKey: string;

  // Signature counter for replay protection
  @Column({ type: 'bigint', default: 0 })
  counter: number;

  // Whether the credential is backed up (synced across devices)
  @Column({ type: 'boolean', default: false })
  credentialBackedUp: boolean;

  // true = multi-device credential, false = single-device
  @Column({ type: 'varchar', length: 20, default: 'singleDevice' })
  credentialDeviceType: string;

  // Transports used (usb, ble, nfc, internal)
  @Column({ type: 'simple-array', nullable: true })
  transports: string[];

  // Human-readable device name (e.g., "My Phone", "Classroom Tablet")
  @Column({ type: 'varchar', length: 255, nullable: true })
  deviceName: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
