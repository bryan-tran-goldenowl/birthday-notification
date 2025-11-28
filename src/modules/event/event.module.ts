import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventService } from './event.service';
import {
  NotificationLog,
  NotificationLogSchema,
} from './schemas/notification-log.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { BirthdayProcessor } from './processors/birthday.processor';
import { AnniversaryProcessor } from './processors/anniversary.processor';
import { EVENT_PROCESSORS } from '../../common/interfaces/event-processor.interface';

const processors = [BirthdayProcessor, AnniversaryProcessor];

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NotificationLog.name, schema: NotificationLogSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [
    ...processors,
    {
      provide: EVENT_PROCESSORS,
      useFactory: (...procs) => procs,
      inject: processors,
    },
    EventService,
  ],
  exports: [
    EventService,
    EVENT_PROCESSORS,
    MongooseModule,
  ],
})
export class EventModule {}
