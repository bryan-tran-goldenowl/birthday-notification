import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  NotificationLog,
  NotificationLogDocument,
} from './schemas/notification-log.schema';
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
    @Inject(EVENT_PROCESSORS)
    private readonly processors: IEventProcessor[],
  ) {
    this.processorMap = new Map();
    for (const processor of processors) {
      this.processorMap.set(processor.getEventType(), processor);
    }
  }

 

  /**
   * Process events for timezone and return created logs
   * Uses bulk upsert to avoid N+1 queries
   */
  async processEventsForTimezone(
    timezone: string,
    users: any[],
    eventType: EventType,
  ): Promise<NotificationLog[]> {
    if (users.length === 0) {
      return [];
    }

    const eventYear = TimezoneUtil.getCurrentYear(timezone);
    const bulkOps = users.map((user) => ({
      updateOne: {
        filter: {
          userId: new Types.ObjectId(user._id.toString()),
          eventType,
          eventYear,
        },
        update: {
          $setOnInsert: {
            userId: new Types.ObjectId(user._id.toString()),
            eventType,
            eventYear,
            status: NotificationStatus.PENDING,
            metadata: { timezone },
            retryCount: 0,
          },
        },
        upsert: true,
      },
    }));

    try {
      await this.notificationLogModel.bulkWrite(bulkOps, { ordered: false });
    } catch (error) {
      if (error.code !== 11000) {
        this.logger.warn(`Bulk upsert error: ${error.message}`);
      }
    }

    
    return this.notificationLogModel
      .find({
        eventYear,
        eventType,
        userId: { $in: users.map((u) => new Types.ObjectId(u._id.toString())) },
      })
      .exec();
  }

  /**
   * Get events that need retry:
   * - FAILED events (ready for retry)
   * - PENDING events stuck > 1 hour (zombie detection)
   * Resets them to PENDING for reprocessing
   */
  async getFailedEventsForRetry(
    maxRetries: number = 12,
  ): Promise<NotificationLog[]> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const eventsToRetry = await this.notificationLogModel
      .find({
        retryCount: { $lt: maxRetries },
        $or: [
          { status: NotificationStatus.FAILED },
          { status: NotificationStatus.PENDING, updatedAt: { $lt: oneHourAgo } },
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

  /**
   * Find notification log by ID
   */
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

  /**
   * Update notification log status
   */
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

  /**
   * Get message for event
   */
  getMessageForEvent(eventLog: any): string {
    const processor = this.processorMap.get(eventLog.eventType);
    if (!processor) {
      return 'Happy event!';
    }

    return processor.generateMessage(eventLog.userId);
  }
}
