import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserEventService } from './user-event.service';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly userEventService: UserEventService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = new this.userModel({
      ...createUserDto,
      birthday: new Date(createUserDto.birthday),
    });
    return await user.save();
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

    
    if (updateUserDto.birthday) {
      updateData.birthday = new Date(updateUserDto.birthday);
    }

    
    if (updateUserDto.anniversaryDate) {
      updateData.anniversaryDate = new Date(updateUserDto.anniversaryDate);
    }

    const user = await this.userModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    
    if (updateUserDto.timezone || updateUserDto.birthday || updateUserDto.anniversaryDate) {
      this.logger.log(`[User Service] Triggering event recalculation for user ${id}`);

    
      this.userEventService.recalculateUserEvents(
        id,
        updateUserDto.timezone,
        updateData.birthday,
        updateData.anniversaryDate,
      ).catch((error) => {
        this.logger.error(
          `[User Service] Failed to trigger event recalculation for user ${id}: ${error.message}`,
        );
      });
    }

    return user;
  }

  async remove(id: string): Promise<void> {
    const result = await this.userModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  
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
