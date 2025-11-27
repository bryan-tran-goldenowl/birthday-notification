import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { DateTime } from 'luxon';
import { UserService } from '../user/user.service';
import { EventService } from '../event/event.service';
import { TimezoneUtil } from '../../common/utils/timezone.util';
import {
  IEventProcessor,
  EVENT_PROCESSORS,
} from '../../common/interfaces/event-processor.interface';

/**
 * Process items in batches with a concurrency limit
 */
async function processInBatches<T, R>(
  items: T[],
  concurrency: number,
  processor: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(processor));
    results.push(...batchResults);
  }

  return results;
}


@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly maxRetryAttempts: number;
  private readonly timezoneBatchSize: number;

  constructor(
    private readonly userService: UserService,
    private readonly eventService: EventService,
    @InjectQueue('notification') private readonly notificationQueue: Queue,
    private readonly configService: ConfigService,
    @Inject(EVENT_PROCESSORS)
    private readonly processors: IEventProcessor[],
  ) {
    this.maxRetryAttempts = this.configService.get<number>(
      'scheduler.maxRetryAttempts',
      12,
    );
    this.timezoneBatchSize = this.configService.get<number>(
      'scheduler.timezoneBatchSize',
      5,
    );
  }

  /**
   * Main scheduler - runs every hour
   * Processes all event types for matching timezones
   */
  @Cron(CronExpression.EVERY_HOUR)
  async scheduleEvents() {
    const startTime = Date.now();
    const now = DateTime.now();
    this.logger.log(`[Scheduler] Running at ${now.toISO()}`);

    try {
      const allTimezones = await this.userService.getDistinctTimezones();
      if (allTimezones.length === 0) {
        this.logger.log('[Scheduler] No users found');
        return;
      }

      for (const processor of this.processors) {
        const eventType = processor.getEventType();
        const checkHour = processor.getCheckHour();

        const targetTimezones = TimezoneUtil.getTimezonesAtHourFromUsers(
          checkHour,
          allTimezones,
        );

        if (targetTimezones.length === 0) continue;

        await processInBatches(
          targetTimezones,
          this.timezoneBatchSize,
          (tz) => this.processTimezoneForEvent(tz, processor),
        );
      }

      const elapsed = Date.now() - startTime;
      this.logger.log(`[Scheduler] Completed in ${elapsed}ms`);
    } catch (error) {
      this.logger.error(`[Scheduler] Error: ${error.message}`, error.stack);
    }
  }

  /**
   * Recovery scheduler - retry failed notifications every 30 minutes
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async scheduleEventRecovery() {
    this.logger.log('[Recovery Scheduler] Running...');

    try {
      const failedEvents = await this.eventService.getFailedEventsForRetry(
        this.maxRetryAttempts,
      );

      if (failedEvents.length === 0) {
        this.logger.log('[Recovery Scheduler] No failed events to retry');
        return;
      }

      this.logger.log(
        `[Recovery Scheduler] Found ${failedEvents.length} failed event(s) to retry`,
      );

      
      const queuePromises = failedEvents.map((eventLog) => {
        const eventLogId = (eventLog as any)._id.toString();

        return this.notificationQueue.add(
          'send-notification',
          { eventLogId },
          { attempts: 1 },
        );
      });

      await Promise.all(queuePromises);

      this.logger.log(
        `[Recovery Scheduler] Queued ${failedEvents.length} retry job(s) successfully`,
      );
    } catch (error) {
      this.logger.error(
        `[Recovery Scheduler] Error: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Process a specific event type for a timezone
   */
  private async processTimezoneForEvent(
    timezone: string,
    processor: IEventProcessor,
  ): Promise<void> {
    const eventType = processor.getEventType();

    try {
      const users = await processor.getUsersToProcess(timezone);
      if (users.length === 0) return;

      this.logger.log(`[Scheduler] ${eventType}: ${users.length} user(s) in ${timezone}`);

      const eventLogs = await this.eventService.processEventsForTimezone(
        timezone,
        users,
        eventType,
      );

      const queuePromises = eventLogs.map((log) =>
        this.notificationQueue.add(
          'send-notification',
          { eventLogId: (log as any)._id.toString() },
          { attempts: 1, removeOnComplete: 20, removeOnFail: 20 },
        ),
      );

      await Promise.all(queuePromises);
      this.logger.log(`[Scheduler] ${eventType}: Queued ${eventLogs.length} job(s)`);
    } catch (error) {
      this.logger.error(
        `[Scheduler] ${eventType} error in ${timezone}: ${error.message}`,
      );
    }
  }

  /**
   * Manual trigger for testing
   */
  async triggerEventCheck(): Promise<{ message: string }> {
    this.logger.log('[Manual Trigger] Event check triggered');
    await this.scheduleEvents();
    return { message: 'Event check triggered successfully' };
  }

  /**
   * Manual trigger for Backfill (Recovery from downtime)
   * Checks all timezones where the check hour has passed for today
   */
  async triggerBackfill(): Promise<{ message: string; details: any }> {
    const startTime = Date.now();
    this.logger.log('[Backfill] Starting manual backfill process...');

    const details = {};

    try {
      const allTimezones = await this.userService.getDistinctTimezones();
      if (allTimezones.length === 0) {
        return { message: 'No users found', details: null };
      }

      for (const processor of this.processors) {
        const eventType = processor.getEventType();
        const checkHour = processor.getCheckHour();

        
        const targetTimezones = allTimezones.filter((tz) =>
          TimezoneUtil.isPastCheckHour(tz, checkHour),
        );

        if (targetTimezones.length === 0) continue;

        this.logger.log(
          `[Backfill] ${eventType}: Processing ${targetTimezones.length} timezone(s) (Catch-up)`,
        );

        await processInBatches(
          targetTimezones,
          this.timezoneBatchSize,
          (tz) => this.processTimezoneForEvent(tz, processor),
        );

        details[eventType] = `${targetTimezones.length} timezones processed`;
      }

      const elapsed = Date.now() - startTime;
      this.logger.log(`[Backfill] Completed in ${elapsed}ms`);
      
      return { 
        message: 'Backfill process completed successfully',
        details 
      };
    } catch (error) {
      this.logger.error(`[Backfill] Error: ${error.message}`, error.stack);
      throw error;
    }
  }
}
