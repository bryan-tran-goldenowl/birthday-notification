import { Injectable, Logger } from '@nestjs/common';
import { WebhookChannel } from './channels/webhook.channel';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly webhookChannel: WebhookChannel) {}

  async sendEventNotification(
    eventLog: any,
    message: string,
  ): Promise<boolean> {
    try {
      const metadata = {
        userId: eventLog.userId._id?.toString() || eventLog.userId.toString(),
        eventType: eventLog.eventType,
        eventYear: eventLog.eventYear,
        eventLogId: eventLog._id.toString(),
      };

      return await this.webhookChannel.send(message, metadata);
    } catch (error) {
      this.logger.error(
        `Error sending notification: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }
}
