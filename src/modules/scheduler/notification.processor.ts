import { Processor, Process } from '@nestjs/bull';
import { Injectable, Logger, Inject } from '@nestjs/common';
import type { Job } from 'bull';
import Redis from 'ioredis';
import { EventService } from '../event/event.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationStatus } from '../../common/enums/notification-status.enum';
import { REDIS_CLIENT } from '../../common/redis/redis.module';

@Processor('notification')
@Injectable()
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly eventService: EventService,
    private readonly notificationService: NotificationService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

 

  @Process({ name: 'send-notification', concurrency: 10 })
  async handleSendNotification(job: Job<{ eventLogId: string }>) {
    const { eventLogId } = job.data;
    const lockKey = `notification-lock:${eventLogId}`;

    
    const lock = await this.redis.set(
      lockKey,
      '1',
      'PX',
      30000,
      'NX',
    );

    if (!lock) {
      this.logger.warn(
        `[Notification Processor] Lock already held for event ${eventLogId}, skipping`,
      );
      return;
    }

    try {
      const eventLog = await this.eventService.findById(eventLogId);

      if (!eventLog) {
        this.logger.error(`[Notification Processor] Event log ${eventLogId} not found`);
        return;
      }

      if (eventLog.status === NotificationStatus.SENT) {
        this.logger.log(
          `[Notification Processor] Event ${eventLogId} already sent, skipping`,
        );
        return;
      }

      const message = this.eventService.getMessageForEvent(eventLog);

      const success = await this.notificationService.sendEventNotification(
        eventLog,
        message,
      );

      if (success) {
        await this.eventService.updateEventStatus(
          eventLogId,
          NotificationStatus.SENT,
        );

        this.logger.log(`[Notification Processor] Successfully sent notification for event ${eventLogId}`);
      } else {
        await this.eventService.updateEventStatus(
          eventLogId,
          NotificationStatus.FAILED,
          'Failed to send webhook',
        );

        this.logger.error(`[Notification Processor] Failed to send notification for event ${eventLogId}`);

        throw new Error('Notification sending failed');
      }
    } catch (error) {
      this.logger.error(
        `[Notification Processor] Error processing event ${eventLogId}: ${error.message}`,
        error.stack,
      );

      try {
        await this.eventService.updateEventStatus(
          eventLogId,
          NotificationStatus.FAILED,
          error.message,
        );
      } catch (updateError) {
        this.logger.error(
          `[Notification Processor] Failed to update event log status: ${updateError.message}`,
        );
      }

      throw error; 
    } finally {
      
      await this.redis.del(lockKey);
    }
  }
}
