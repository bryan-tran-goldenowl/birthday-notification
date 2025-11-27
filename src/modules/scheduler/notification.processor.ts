import { Processor, Process } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bull';
import Redis from 'ioredis';
import { EventService } from '../event/event.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationStatus } from '../../common/enums/notification-status.enum';

@Processor('notification')
@Injectable()
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);
  private readonly redis: Redis;

  constructor(
    private readonly eventService: EventService,
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
  ) {
    // Initialize Redis client for distributed locking
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

  /**
   * Process send-notification jobs from the queue
   */
  @Process('send-notification')
  async handleSendNotification(job: Job<{ eventLogId: string }>) {
    const { eventLogId } = job.data;
    const lockKey = `notification-lock:${eventLogId}`;

    this.logger.log(`[Notification Processor] Processing job ${job.id} for event ${eventLogId}`);

    // Acquire distributed lock (30s TTL, only set if not exists)
    const lock = await this.redis.set(
      lockKey,
      '1',
      'PX',
      30000, // 30 seconds TTL
      'NX', // Only set if not exists
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

      this.logger.log(`[Notification Processor] Sending notification: "${message}"`);
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
      this.logger.log(`[Notification Processor] Released lock for event ${eventLogId}`);
    }
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy() {
    await this.redis.quit();
  }
}
