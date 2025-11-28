import { Injectable, Logger } from '@nestjs/common';
import { EventService } from '../event/event.service';


@Injectable()
export class UserEventService {
  private readonly logger = new Logger(UserEventService.name);

  constructor(private readonly eventService: EventService) {}

  
  async recalculateUserEvents(
    userId: string,
    timezone?: string,
    birthday?: Date,
    anniversaryDate?: Date,
  ): Promise<void> {
    this.logger.log(
      `[User Event Service] Triggering event recalculation for user ${userId}`,
    );

    try {
      await this.eventService.recalculateUserEvents(
        userId,
        timezone,
        birthday,
        anniversaryDate,
      );
    } catch (error) {
      this.logger.error(
        `[User Event Service] Error recalculating events for user ${userId}: ${error.message}`,
      );
      
    }
  }
}
