import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IEventProcessor } from '../../../common/interfaces/event-processor.interface';
import { EventType } from '../../../common/enums/event-type.enum';
import { TimezoneUtil } from '../../../common/utils/timezone.util';
import { User, UserDocument } from '../../user/schemas/user.schema';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BirthdayProcessor implements IEventProcessor {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
  ) {
    
  }

  getEventType(): EventType {
    return EventType.BIRTHDAY;
  }

  getCheckHour(): number {
    return this.configService.get('scheduler.birthdayCheckHour', 9);
  }

  async getUsersToProcess(timezone: string): Promise<User[]> {
    const { month, day } = TimezoneUtil.getTodayMonthDay(timezone);

    return this.userModel
      .find({
        timezone,
        $expr: {
          $and: [
            { $eq: [{ $month: '$birthday' }, month] },
            { $eq: [{ $dayOfMonth: '$birthday' }, day] },
          ],
        },
      })
      .lean()
      .exec();
  }

  generateMessage(user: any): string {
    const fullName = user.fullName || `${user.firstName} ${user.lastName}`;
    return `Hey, ${fullName} it's your birthday`;
  }
}
