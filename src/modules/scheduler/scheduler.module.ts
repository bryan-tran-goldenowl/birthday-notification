import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { SchedulerService } from './scheduler.service';
import { SchedulerController } from './scheduler.controller';
import { NotificationProcessor } from './notification.processor';
import { UserModule } from '../user/user.module';
import { EventModule } from '../event/event.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notification',
    }),
    UserModule,
    EventModule,
    NotificationModule,
  ],
  controllers: [SchedulerController],
  providers: [SchedulerService, NotificationProcessor],
  exports: [SchedulerService],
})
export class SchedulerModule {}
