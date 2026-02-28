import { AppDataSource } from '../config/database';
import { User } from '../entities/User.entity';
import { RegisterDto, LoginDto, ChangePasswordDto } from '../dto/auth.dto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import bcrypt from 'bcryptjs';
import { Role } from '../enums/Role.enum';
import { Gender } from '../enums/Gender.enum';
import emailService from './email.service';

export class AuthService {
  private userRepository = AppDataSource.getRepository(User);

  // Register new user
  async register(data: RegisterDto) {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: [
        { email: data.email },
        { username: data.username },
        { mobileNumber: (data as any).mobileNumber },
        { nic: (data as any).nic },
      ],
    });

    if (existingUser) {
      if (existingUser.email === data.email) {
        throw new Error('Email already registered');
      }
      if (existingUser.username === data.username) {
        throw new Error('Username already taken');
      }
      if (existingUser.mobileNumber === (data as any).mobileNumber) {
        throw new Error('Mobile number already registered');
      }
      if (existingUser.nic === (data as any).nic) {
        throw new Error('NIC already registered');
      }
    }

    // Generate unique registration number
    const registrationNumber = await this.generateRegistrationNumber();

    // Create new user
    const user = this.userRepository.create({
      username: data.username,
      email: data.email,
      password: data.password, // Will be hashed by entity hook
      firstName: data.firstName,
      lastName: data.lastName,
      role: (data.role as Role) || Role.STUDENT,
      registrationNumber,
      nameWithInitials: this.generateNameWithInitials(data.firstName, data.lastName),
      title: 'Mr',
      gender: Gender.OTHER,
      dateOfBirth: new Date('2000-01-01'),
      nic: (data as any).nic,
      mobileNumber: (data as any).mobileNumber,
      address: 'Not provided',
    });

    await this.userRepository.save(user);

    // Send account creation email
    if (user.email) {
      try {
        await emailService.sendAccountCreationEmail(
          user.email,
          user.firstName,
          user.username,
          data.password
        );
      } catch (emailError) {
        console.error('Failed to send account creation email during registration:', emailError);
      }
    }

    // Generate token
    const token = this.generateToken(user.id, user.role);

    // Return user without password
    const { password, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
    };
  }

  // Login user
  async login(data: LoginDto) {
    // Find user with password
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email: data.email })
      .getOne();

    if (!user) {
      throw new Error('Invalid email or password');
    }

    if (!user.isActive) {
      throw new Error('Account is inactive. Please contact administrator.');
    }

    // Validate password
    const isValidPassword = await bcrypt.compare(data.password, user.password);

    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Generate token
    const token = this.generateToken(user.id, user.role);

    // Return user without password
    const { password, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
    };
  }

  // Get current user
  async getCurrentUser(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['center'],
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  // Change password
  async changePassword(userId: string, data: ChangePasswordDto) {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id: userId })
      .getOne();

    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(data.currentPassword, user.password);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Update password
    user.password = data.newPassword; // Will be hashed by entity hook
    await this.userRepository.save(user);

    // Send password changed email
    if (user.email) {
      try {
        await emailService.sendPasswordChangedEmail(user.email, user.firstName);
      } catch (emailError) {
        console.error('Failed to send password changed email:', emailError);
      }
    }

    return { message: 'Password changed successfully' };
  }

  // Update user profile
  async updateProfile(userId: string, data: any) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Update allowed fields
    const allowedFields = [
      'firstName',
      'lastName',
      'title',
      'gender',
      'dateOfBirth',
      'address',
      'mobileNumber',
      'homeNumber',
      'profilePic',
    ];

    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        (user as any)[field] = data[field];
      }
    });

    // Update name with initials if names changed
    if (data.firstName || data.lastName) {
      user.nameWithInitials = this.generateNameWithInitials(
        user.firstName,
        user.lastName
      );
    }

    await this.userRepository.save(user);

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Logout (token invalidation would be handled client-side or with Redis)
  async logout() {
    return { message: 'Logged out successfully' };
  }

  // Generate JWT token
  private generateToken(userId: string, role: Role): string {
    return jwt.sign({ userId, role }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRE,
    } as jwt.SignOptions);
  }

  // Generate unique registration number
  private async generateRegistrationNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `REG${year}`;
    
    const lastUser = await this.userRepository
      .createQueryBuilder('user')
      .where('user.registrationNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('user.registrationNumber', 'DESC')
      .getOne();

    let nextNumber = 1;
    if (lastUser && lastUser.registrationNumber) {
      const lastNumberStr = lastUser.registrationNumber.substring(prefix.length);
      const lastNumber = parseInt(lastNumberStr, 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    const number = String(nextNumber).padStart(4, '0');
    return `${prefix}${number}`;
  }

  // Generate temporary unique mobile number
  private async generateTempMobileNumber(): Promise<string> {
    const lastUser = await this.userRepository
      .createQueryBuilder('user')
      .where('user.mobileNumber LIKE :prefix', { prefix: 'TEMP%' })
      .orderBy('user.mobileNumber', 'DESC')
      .getOne();

    let nextNumber = 1;
    if (lastUser && lastUser.mobileNumber && lastUser.mobileNumber.startsWith('TEMP')) {
      const lastNumberStr = lastUser.mobileNumber.substring(4);
      const lastNumber = parseInt(lastNumberStr, 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    const number = String(nextNumber).padStart(6, '0');
    return `TEMP${number}`;
  }

  // Generate name with initials
  private generateNameWithInitials(firstName: string, lastName: string): string {
    const initials = firstName
      .split(' ')
      .map(name => name.charAt(0).toUpperCase())
      .join('.');
    return `${initials}. ${lastName}`;
  }
}

export default new AuthService();
