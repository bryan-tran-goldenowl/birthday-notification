import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { User, UserDocument } from '../user/schemas/user.schema';
import { EventService } from '../event/event.service';
import { EventType } from '../../common/enums/event-type.enum';
import { NotificationStatus } from '../../common/enums/notification-status.enum';
import { TimezoneUtil } from '../../common/utils/timezone.util';
import { REDIS_CLIENT } from '../../common/redis/redis.module';
import {
  IEventProcessor,
  EVENT_PROCESSORS,
} from '../../common/interfaces/event-processor.interface';

@Injectable()
export class EventGeneratorService {
  private readonly logger = new Logger(EventGeneratorService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly eventService: EventService,
    @Inject(EVENT_PROCESSORS) private readonly processors: IEventProcessor[],
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  
  async generateEvents(): Promise<void> {
    const LOCK_KEY = 'scheduler:lock:generate-events';
    const LOCK_TTL = this.configService.get<number>('scheduler.lockTtl', 300000);

    
    const locked = await this.redis.set(
      LOCK_KEY,
      'locked',
      'PX',
      LOCK_TTL,
      'NX',
    );

    if (!locked) {
      this.logger.warn(
        '[Generator] Skipped: Generator is already running on another instance',
      );
      return;
    }

    try {
      const DAYS_TO_SCAN = this.configService.get<number>('generator.daysToScan', 30);
      const CONCURRENCY_LIMIT = this.configService.get<number>(
        'generator.concurrencyLimit',
        10,
      );
      const CURSOR_BATCH_SIZE = this.configService.get<number>(
        'generator.cursorBatchSize',
        10000,
      );
      const BULK_WRITE_BATCH_SIZE = this.configService.get<number>(
        'generator.bulkWriteBatchSize',
        5000,
      );
      const now = new Date();
      let processedCount = 0;

      const dayOffsets = Array.from({ length: DAYS_TO_SCAN }, (_, i) => i);

      for (let i = 0; i < dayOffsets.length; i += CONCURRENCY_LIMIT) {
        const chunk = dayOffsets.slice(i, i + CONCURRENCY_LIMIT);
        
        await Promise.all(
          chunk.map(async (dayOffset) => {
            const targetDate = new Date(now);
            targetDate.setDate(now.getDate() + dayOffset);

            const targetMonth = targetDate.getMonth() + 1;
            const targetDay = targetDate.getDate();
            const targetYear = targetDate.getFullYear();

            const isNonLeapFeb28 =
              targetMonth === 2 && targetDay === 28 && !this.isLeapYear(targetYear);

            for (const processor of this.processors) {
              const eventType = processor.getEventType();
              const eventDateField =
                eventType === EventType.BIRTHDAY ? 'birthday' : 'anniversaryDate';

              const matchCondition = [
                { $eq: [{ $month: `$${eventDateField}` }, targetMonth] },
                { $eq: [{ $dayOfMonth: `$${eventDateField}` }, targetDay] },
              ];

              let queryFilter: any = {
                $expr: { $and: matchCondition },
                [eventDateField]: { $exists: true, $ne: null },
              };

              if (isNonLeapFeb28) {
                queryFilter = {
                  $expr: {
                    $or: [
                      { $and: matchCondition },
                      {
                        $and: [
                          { $eq: [{ $month: `$${eventDateField}` }, 2] },
                          { $eq: [{ $dayOfMonth: `$${eventDateField}` }, 29] },
                        ],
                      },
                    ],
                  },
                  [eventDateField]: { $exists: true, $ne: null },
                };
              }

              const cursor = this.userModel
                .find(queryFilter)
                .lean()
                .cursor({ batchSize: CURSOR_BATCH_SIZE });

              const operations: any[] = [];
              
              for await (const user of cursor) {
                try {
                  const userOps = this.generateUserOps(
                    user,
                    processor,
                    targetYear,
                  );
                  if (userOps.length > 0) {
                    operations.push(...userOps);
                  }

                  if (operations.length >= BULK_WRITE_BATCH_SIZE) {
                    await this.eventService.bulkUpsertEvents(operations);
                    processedCount += operations.length;
                    operations.length = 0;
                  }
                } catch (error) {
                  this.logger.error(
                    `[Generator] Error for user ${user._id}: ${error.message}`,
                  );
                }
              }

              if (operations.length > 0) {
                await this.eventService.bulkUpsertEvents(operations);
                processedCount += operations.length;
              }
            }
          })
        );
      }

    } catch (error) {
      this.logger.error(`[Generator] Error: ${error.message}`, error.stack);
      throw error;
    } finally {
      await this.redis.del(LOCK_KEY);
    }
  }

  /**
   * Generate single event op for a specific target year
   */
  private generateUserOps(
    user: any,
    processor: IEventProcessor,
    targetYear: number,
  ): any[] {
    const eventType = processor.getEventType();
    const checkHour = processor.getCheckHour();
    
    const eventDate = this.getEventDateForUser(user, eventType);
    if (!eventDate) return [];

    try {
      const scheduledAt = TimezoneUtil.calculateScheduledAt(
        eventDate,
        checkHour,
        user.timezone,
        targetYear,
      );

      return [{
        updateOne: {
          filter: {
            userId: user._id,
            eventType,
            eventYear: targetYear,
          },
          update: {
            $setOnInsert: {
              userId: user._id,
              eventType,
              eventYear: targetYear,
              status: NotificationStatus.PENDING,
              scheduledAt,
              metadata: { timezone: user.timezone },
              retryCount: 0,
            },
          },
          upsert: true,
        },
      }];
    } catch (error) {
      
      return [];
    }
  }

  private isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  private getEventDateForUser(user: User, eventType: EventType): Date | null {
    if (eventType === EventType.BIRTHDAY) {
      return user.birthday;
    } else if (eventType === EventType.ANNIVERSARY) {
      return user.anniversaryDate || null;
    }
    return null;
  }
}