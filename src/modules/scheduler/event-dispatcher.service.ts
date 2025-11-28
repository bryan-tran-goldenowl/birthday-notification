import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { EventService } from '../event/event.service';

@Injectable()
export class EventDispatcherService {
  private readonly logger = new Logger(EventDispatcherService.name);

  constructor(
    private readonly eventService: EventService,
    @InjectQueue('notification') private readonly notificationQueue: Queue,
  ) {}

  async dispatchEvents(): Promise<void> {
    try {
      const now = new Date();

      const eventsToDispatch =
        await this.eventService.findEventsDueForDispatch(now);

      if (eventsToDispatch.length === 0) {
        return;
      }

      const queuePromises = eventsToDispatch.map((event) => {
        const eventLogId = (event as any)._id.toString();

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
    } catch (error) {
      this.logger.error(
        `[Dispatcher] Error: ${error.message}`,

        error.stack,
      );

      throw error;
    }
  }
}
