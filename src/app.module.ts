import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { DatabaseModule } from './database/database.module';
import { UserModule } from './modules/user/user.module';
import { EventModule } from './modules/event/event.module';
import { NotificationModule } from './modules/notification/notification.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { HealthController } from './common/controllers/health.controller';
import { TestWebhookController } from './common/controllers/test-webhook.controller';
import { RedisModule } from './common/redis/redis.module';
import appConfig from './config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    RedisModule,
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB ?? '0'),
      },
    }),
    DatabaseModule,
    UserModule,
    EventModule,
    NotificationModule,
    SchedulerModule,
  ],
  controllers: [HealthController, TestWebhookController],
})
export class AppModule {}
