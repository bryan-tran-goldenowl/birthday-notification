import { Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService implements OnModuleDestroy {
  private readonly logger = new Logger(UserService.name);
  private readonly redis: Redis;
  private readonly CACHE_KEY = 'CACHE:TIMEZONES';
  private readonly CACHE_TTL = 3600; // 1 hour in seconds

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
  ) {
    this.redis = new Redis({
      host: this.configService.get('redis.host', 'localhost'),
      port: this.configService.get('redis.port', 6379),
      password: this.configService.get('redis.password', ''),
      db: this.configService.get('redis.db', 0),
    });

    this.redis.on('error', (error) => {
      this.logger.error(`Redis connection error: ${error.message}`);
    });
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = new this.userModel({
      ...createUserDto,
      birthday: new Date(createUserDto.birthday),
    });
    const saved = await user.save();
    await this.invalidateTimezoneCache();
    return saved;
  }

  async findAll(): Promise<User[]> {
    return await this.userModel.find().exec();
  }

  async findById(id: string): Promise<User> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const updateData: any = { ...updateUserDto };

    // Convert birthday string to Date if provided
    if (updateUserDto.birthday) {
      updateData.birthday = new Date(updateUserDto.birthday);
    }

    const user = await this.userModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Invalidate cache if timezone was updated
    if (updateUserDto.timezone) {
      await this.invalidateTimezoneCache();
    }

    return user;
  }

  async remove(id: string): Promise<void> {
    const result = await this.userModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    await this.invalidateTimezoneCache();
  }

  /**
   * Get all distinct timezones from users (cached in Redis for 1 hour)
   */
  async getDistinctTimezones(): Promise<string[]> {
    try {
      const cached = await this.redis.get(this.CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      this.logger.error(`Redis get error: ${error.message}`);
    }

    const timezones = await this.userModel.distinct('timezone').exec();

    try {
      await this.redis.set(
        this.CACHE_KEY,
        JSON.stringify(timezones),
        'EX',
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Redis set error: ${error.message}`);
    }

    return timezones;
  }

  /**
   * Invalidate timezone cache (call when user is created/updated/deleted)
   */
  async invalidateTimezoneCache(): Promise<void> {
    try {
      await this.redis.del(this.CACHE_KEY);
    } catch (error) {
      this.logger.error(`Redis del error: ${error.message}`);
    }
  }

  /**
   * Get user statistics by timezone
   */
  async getUserStats(): Promise<any> {
    const total = await this.userModel.countDocuments().exec();
    const byTimezone = await this.userModel.aggregate([
      {
        $group: {
          _id: '$timezone',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    return {
      total,
      byTimezone,
    };
  }
}
