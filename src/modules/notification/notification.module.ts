import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { WebhookChannel } from './channels/webhook.channel';

@Module({
  providers: [NotificationService, WebhookChannel],
  exports: [NotificationService],
})
export class NotificationModule {}
