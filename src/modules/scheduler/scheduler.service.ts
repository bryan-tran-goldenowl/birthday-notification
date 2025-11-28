import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { EventService } from '../event/event.service';
import { EventGeneratorService } from './event-generator.service';
import { EventDispatcherService } from './event-dispatcher.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly maxRetryAttempts: number;

  constructor(
    private readonly eventService: EventService,
    private readonly eventGeneratorService: EventGeneratorService,
    private readonly eventDispatcherService: EventDispatcherService,
    @InjectQueue('notification') private readonly notificationQueue: Queue,
    private readonly configService: ConfigService,
  ) {
    this.maxRetryAttempts = this.configService.get<number>(
      'scheduler.maxRetryAttempts',
      12,
    );
  }

 
  @Cron(CronExpression.EVERY_HOUR, { name: 'generate-events' })
  async generateEvents() {
    this.logger.log('[Scheduler] Running Event Generator...');
    try {
      await this.eventGeneratorService.generateEvents();
    } catch (error) {
      this.logger.error(`[Scheduler] Generator error: ${error.message}`, error.stack);
    }
  }

 
  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'dispatch-events' })
  async dispatchEvents() {
    this.logger.log('[Scheduler] Running Event Dispatcher...');
    try {
      await this.eventDispatcherService.dispatchEvents();
    } catch (error) {
      this.logger.error(`[Scheduler] Dispatcher error: ${error.message}`, error.stack);
    }
  }

 
  @Cron(CronExpression.EVERY_30_MINUTES, { name: 'recovery-events' })
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
          {
            jobId: eventLogId,
            attempts: 1,
            removeOnComplete: true,
            removeOnFail: true,
          },
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
   * Manual trigger for event generation (testing)
   */
  async triggerGeneration(): Promise<{ message: string }> {
    this.logger.log('[Manual Trigger] Event generation triggered');
    await this.eventGeneratorService.generateEvents();
    return { message: 'Event generation triggered successfully' };
  }

  /**
   * Manual trigger for event dispatch (testing)
   */
  async triggerDispatch(): Promise<{ message: string }> {
    this.logger.log('[Manual Trigger] Event dispatch triggered');
    await this.eventDispatcherService.dispatchEvents();
    return { message: 'Event dispatch triggered successfully' };
  }
}
