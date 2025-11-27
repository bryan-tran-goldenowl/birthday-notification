import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { INotificationChannel } from '../../../common/interfaces/notification-channel.interface';

@Injectable()
export class WebhookChannel implements INotificationChannel {
  private readonly logger = new Logger(WebhookChannel.name);
  private readonly webhookUrl: string;
  private readonly timeout: number;

  constructor(private readonly configService: ConfigService) {
    
    this.webhookUrl = this.configService.get<string>('webhook.url') || 'https://your-webhook-url.com';
    
    this.timeout = this.configService.get<number>('webhook.timeout') || 10000;
  }

  getChannelName(): string {
    return 'webhook';
  }

  async send(
    message: string,
    metadata?: Record<string, any>,
  ): Promise<boolean> {
    try {
      this.logger.log(`Sending webhook: ${message}`);

      const response = await axios.post(
        this.webhookUrl,
        {
          message,
          ...metadata,
          timestamp: new Date().toISOString(),
        },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.status >= 200 && response.status < 300) {
        this.logger.log(`Webhook sent successfully: ${message}`);
        return true;
      }

      this.logger.warn(
        `Webhook returned status ${response.status}: ${message}`,
      );
      return false;
    } catch (error) {
      this.logger.error(
        `Failed to send webhook: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }
}
