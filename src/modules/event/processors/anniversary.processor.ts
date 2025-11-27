import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IEventProcessor } from '../../../common/interfaces/event-processor.interface';
import { EventType } from '../../../common/enums/event-type.enum';
import { TimezoneUtil } from '../../../common/utils/timezone.util';
import { User, UserDocument } from '../../user/schemas/user.schema';

@Injectable()
export class AnniversaryProcessor implements IEventProcessor {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  getEventType(): EventType {
    return EventType.ANNIVERSARY;
  }

  getCheckHour(): number {
    return 10;
  }

  async getUsersToProcess(timezone: string): Promise<User[]> {
    const { month, day } = TimezoneUtil.getTodayMonthDay(timezone);

    return this.userModel
      .find({
        timezone,
        anniversaryDate: { $exists: true, $ne: null },
        $expr: {
          $and: [
            { $eq: [{ $month: '$anniversaryDate' }, month] },
            { $eq: [{ $dayOfMonth: '$anniversaryDate' }, day] },
          ],
        },
      })
      .lean()
      .exec();
  }

  generateMessage(user: any): string {
    const fullName = user.fullName || `${user.firstName} ${user.lastName}`;
    return `Happy Anniversary, ${fullName}!`;
  }
}
