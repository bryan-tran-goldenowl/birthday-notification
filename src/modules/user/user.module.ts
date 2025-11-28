import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserEventService } from './user-event.service';
import { User, UserSchema } from './schemas/user.schema';
import { EventModule } from '../event/event.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    EventModule, // Import EventModule to get EventService for UserEventService
  ],
  controllers: [UserController],
  providers: [UserService, UserEventService],
  exports: [UserService],
})
export class UserModule {}
