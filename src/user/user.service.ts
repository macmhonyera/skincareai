import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = this.userRepository.create({
      email: createUserDto.email.trim().toLowerCase(),
      name: createUserDto.name?.trim() || null,
      skinType: createUserDto.skinType?.trim().toLowerCase() || null,
      skinConcerns: this.normalizeList(createUserDto.skinConcerns),
      sensitivities: this.normalizeList(createUserDto.sensitivities),
      routineGoal: createUserDto.routineGoal?.trim() || null,
      budgetLevel: createUserDto.budgetLevel?.trim().toLowerCase() || null,
      passwordHash: null,
      planTier: 'free',
      profileImageUrl: null,
      lastLoginAt: null,
    });

    return this.userRepository.save(user);
  }

  findAll(): Promise<User[]> {
    return this.userRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  findOne(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: {
        id,
      },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User | null> {
    const user = await this.findOne(id);
    if (!user) {
      return null;
    }

    if (typeof updateUserDto.name === 'string') {
      user.name = updateUserDto.name.trim() || null;
    }
    if (typeof updateUserDto.skinType === 'string') {
      user.skinType = updateUserDto.skinType.trim().toLowerCase() || null;
    }
    if (Array.isArray(updateUserDto.skinConcerns)) {
      user.skinConcerns = this.normalizeList(updateUserDto.skinConcerns);
    }
    if (Array.isArray(updateUserDto.sensitivities)) {
      user.sensitivities = this.normalizeList(updateUserDto.sensitivities);
    }
    if (typeof updateUserDto.routineGoal === 'string') {
      user.routineGoal = updateUserDto.routineGoal.trim() || null;
    }
    if (typeof updateUserDto.budgetLevel === 'string') {
      user.budgetLevel = updateUserDto.budgetLevel.trim().toLowerCase() || null;
    }

    return this.userRepository.save(user);
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const result = await this.userRepository.delete(id);
    return { deleted: (result.affected ?? 0) > 0 };
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: {
        email: email.trim().toLowerCase(),
      },
    });
  }

  save(user: User | Partial<User>): Promise<User> {
    return this.userRepository.save(user);
  }

  sanitizeUser(user: User) {
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  private normalizeList(values?: string[]): string[] | null {
    if (!values || values.length === 0) {
      return null;
    }

    const normalized = Array.from(
      new Set(
        values
          .map((value) => value.trim().toLowerCase())
          .filter((value) => value.length > 0),
      ),
    );

    return normalized.length > 0 ? normalized : null;
  }
}
