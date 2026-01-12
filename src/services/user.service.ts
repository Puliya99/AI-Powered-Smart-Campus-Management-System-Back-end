import { AppDataSource } from '../config/database';
import { User } from '../entities/User.entity';
import { Role } from '../enums/Role.enum';
import { Gender } from '../enums/Gender.enum';

export class UserService {
  private userRepository = AppDataSource.getRepository(User);

  // Get all users with pagination and filters
  async getAllUsers(options: {
    page?: number;
    limit?: number;
    search?: string;
    role?: Role;
    isActive?: boolean;
    centerId?: string;
  }) {
    const { page = 1, limit = 10, search = '', role, isActive, centerId } = options;
    const skip = (page - 1) * limit;

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.center', 'center')
      .skip(skip)
      .take(limit)
      .orderBy('user.createdAt', 'DESC');

    if (search) {
      queryBuilder.where(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search OR user.username ILIKE :search OR user.registrationNumber ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('user.isActive = :isActive', { isActive });
    }

    if (centerId) {
      queryBuilder.andWhere('center.id = :centerId', { centerId });
    }

    const [users, total] = await queryBuilder.getManyAndCount();

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // Get user by ID
  async getUserById(id: string) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['center'],
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  // Create new user
  async createUser(userData: any) {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: [
        { email: userData.email },
        { username: userData.username },
        { nic: userData.nic },
        { mobileNumber: userData.mobileNumber }
      ],
    });

    if (existingUser) {
      if (existingUser.email === userData.email) throw new Error('Email already registered');
      if (existingUser.username === userData.username) throw new Error('Username already taken');
      if (existingUser.nic === userData.nic) throw new Error('NIC already registered');
      if (existingUser.mobileNumber === userData.mobileNumber) throw new Error('Mobile number already registered');
    }

    if (!userData.registrationNumber) {
      userData.registrationNumber = await this.generateRegistrationNumber();
    }

    if (!userData.nameWithInitials) {
      userData.nameWithInitials = this.generateNameWithInitials(userData.firstName, userData.lastName);
    }

    const user = this.userRepository.create(userData);
    await this.userRepository.save(user);

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Update user
  async updateUser(id: string, userData: any) {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new Error('User not found');
    }

    // Check for unique fields if they are being updated
    if (userData.email && userData.email !== user.email) {
      const exists = await this.userRepository.findOne({ where: { email: userData.email } });
      if (exists) throw new Error('Email already registered');
    }

    if (userData.username && userData.username !== user.username) {
      const exists = await this.userRepository.findOne({ where: { username: userData.username } });
      if (exists) throw new Error('Username already taken');
    }

    if (userData.nic && userData.nic !== user.nic) {
      const exists = await this.userRepository.findOne({ where: { nic: userData.nic } });
      if (exists) throw new Error('NIC already registered');
    }

    if (userData.mobileNumber && userData.mobileNumber !== user.mobileNumber) {
      const exists = await this.userRepository.findOne({ where: { mobileNumber: userData.mobileNumber } });
      if (exists) throw new Error('Mobile number already registered');
    }

    if (userData.firstName || userData.lastName) {
      userData.nameWithInitials = this.generateNameWithInitials(
        userData.firstName || user.firstName,
        userData.lastName || user.lastName
      );
    }

    Object.assign(user, userData);
    await this.userRepository.save(user);

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Delete user
  async deleteUser(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new Error('User not found');
    }
    await this.userRepository.remove(user);
    return { message: 'User deleted successfully' };
  }

  // Get user statistics
  async getUserStats() {
    const totalUsers = await this.userRepository.count();
    const activeUsers = await this.userRepository.count({ where: { isActive: true } });
    const adminCount = await this.userRepository.count({ where: { role: Role.ADMIN } });
    const lecturerCount = await this.userRepository.count({ where: { role: Role.LECTURER } });
    const studentCount = await this.userRepository.count({ where: { role: Role.STUDENT } });
    const staffCount = await this.userRepository.count({ where: { role: Role.USER } });

    return {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      roles: {
        ADMIN: adminCount,
        LECTURER: lecturerCount,
        STUDENT: studentCount,
        STAFF: staffCount,
      },
    };
  }

  // Helpers
  private async generateRegistrationNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.userRepository.count();
    const number = String(count + 1).padStart(4, '0');
    return `REG${year}${number}`;
  }

  private generateNameWithInitials(firstName: string, lastName: string): string {
    const initials = firstName
      .split(' ')
      .map(name => name.charAt(0).toUpperCase())
      .join('.');
    return `${initials}. ${lastName}`;
  }
}

export default new UserService();
