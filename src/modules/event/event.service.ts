import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  NotificationLog,
  NotificationLogDocument,
} from './schemas/notification-log.schema';
import { User, UserDocument } from '../user/schemas/user.schema';
import { EventType } from '../../common/enums/event-type.enum';
import { NotificationStatus } from '../../common/enums/notification-status.enum';
import { TimezoneUtil } from '../../common/utils/timezone.util';
import {
  IEventProcessor,
  EVENT_PROCESSORS,
} from '../../common/interfaces/event-processor.interface';

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);
  private readonly processorMap: Map<EventType, IEventProcessor>;

  constructor(
    @InjectModel(NotificationLog.name)
    private readonly notificationLogModel: Model<NotificationLogDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @Inject(EVENT_PROCESSORS)
    private readonly processors: IEventProcessor[],
  ) {
    this.processorMap = new Map();
    for (const processor of processors) {
      this.processorMap.set(processor.getEventType(), processor);
    }
  }

 
  async getFailedEventsForRetry(
    maxRetries: number = 12,
  ): Promise<NotificationLog[]> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const now = new Date();

    const eventsToRetry = await this.notificationLogModel
      .find({
        retryCount: { $lt: maxRetries },
        $or: [
          { status: NotificationStatus.FAILED },
          {
            status: NotificationStatus.PENDING,
            updatedAt: { $lt: oneHourAgo },
            scheduledAt: { $lte: now },
          },
        ],
      })
      .populate('userId')
      .sort({ createdAt: 1 })
      .exec();

    if (eventsToRetry.length > 0) {
      const ids = eventsToRetry.map((e) => (e as any)._id);
      await this.notificationLogModel.updateMany(
        { _id: { $in: ids } },
        { $set: { status: NotificationStatus.PENDING } },
      );
    }

    return eventsToRetry;
  }


  async findById(id: string): Promise<NotificationLog> {
    const log = await this.notificationLogModel
      .findById(id)
      .populate('userId')
      .exec();

    if (!log) {
      throw new Error(`Notification log ${id} not found`);
    }

    return log;
  }

  
  async updateEventStatus(
    id: string,
    status: NotificationStatus,
    errorMessage?: string,
  ): Promise<void> {
    const updateData: any = {
      status,
      ...(status === NotificationStatus.SENT && { sentAt: new Date() }),
      ...(status === NotificationStatus.FAILED && { errorMessage }),
    };

    
    if (status === NotificationStatus.FAILED) {
      updateData.$inc = { retryCount: 1 };
    }

    await this.notificationLogModel.findByIdAndUpdate(id, updateData).exec();
  }

  
  getMessageForEvent(eventLog: any): string {
    const processor = this.processorMap.get(eventLog.eventType);
    if (!processor) {
      return 'Happy event!';
    }

    return processor.generateMessage(eventLog.userId);
  }

  
  async findEventsDueForDispatch(now: Date): Promise<NotificationLog[]> {
    return this.notificationLogModel
      .find({
        status: NotificationStatus.PENDING,
        scheduledAt: { $lte: now },
      })
      .sort({ scheduledAt: 1 })
      .limit(5000)
      .exec();
  }

 
  async bulkUpsertEvents(operations: any[]): Promise<void> {
    try {
      await this.notificationLogModel.bulkWrite(operations, { ordered: false });
    } catch (error) {
      
      if (error.code !== 11000) {
        throw error;
      }
    }
  }

  
  async recalculateUserEvents(
    userId: string,
    newTimezone?: string,
    newBirthday?: Date,
    newAnniversary?: Date,
  ): Promise<void> {
  
    const user = await this.userModel.findById(userId).lean().exec();
    if (!user) {
      this.logger.warn(`[Event Service] User ${userId} not found for recalculation`);
      return;
    }

    const timezone = newTimezone || user.timezone;
    const birthday = newBirthday || user.birthday;
    const anniversary = newAnniversary || user.anniversaryDate;

    const now = new Date();

    
    const futureEvents = await this.notificationLogModel
      .find({
        userId: new Types.ObjectId(userId),
        status: { $in: [NotificationStatus.PENDING, NotificationStatus.FAILED] },
        scheduledAt: { $gt: now }, 
      })
      .exec();

    if (futureEvents.length === 0) {
      this.logger.log(`[Event Service] No future events to recalculate for user ${userId}`);
      return;
    }

    this.logger.log(
      `[Event Service] Recalculating ${futureEvents.length} event(s) for user ${userId}`,
    );

    
    for (const event of futureEvents) {
      try {
        const eventDate =
          event.eventType === EventType.BIRTHDAY ? birthday : anniversary;

        if (!eventDate) {
          this.logger.warn(
            `[Event Service] No event date for ${event.eventType} event ${event._id}`,
          );
          continue;
        }

        const checkHour = event.eventType === EventType.BIRTHDAY ? 9 : 10;

        const newScheduledAt = TimezoneUtil.calculateScheduledAt(
          eventDate,
          checkHour,
          timezone,
          event.eventYear,
        );

        await this.notificationLogModel.updateOne(
          { _id: event._id },
          {
            $set: {
              scheduledAt: newScheduledAt,
              'metadata.timezone': timezone,
            },
          },
        );

        this.logger.debug(
          `[Event Service] Recalculated event ${event._id}: ${newScheduledAt}`,
        );
      } catch (error) {
        this.logger.error(
          `[Event Service] Error recalculating event ${event._id}: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `[Event Service] Successfully recalculated events for user ${userId}`,
    );
  }
}
