import { Test, TestingModule } from '@nestjs/testing';
import { UserEventService } from './user-event.service';
import { EventService } from '../event/event.service';
import { Logger } from '@nestjs/common';

describe('UserEventService', () => {
  let service: UserEventService;
  let eventService: any;

  const mockEventService = {
    recalculateUserEvents: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserEventService,
        { provide: EventService, useValue: mockEventService },
      ],
    }).compile();

    service = module.get<UserEventService>(UserEventService);
    eventService = module.get<EventService>(EventService);

    jest.clearAllMocks();
    
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  describe('recalculateUserEvents', () => {
    const userId = 'testUserId';
    const timezone = 'America/New_York';
    const birthday = new Date('2000-01-01');
    const anniversaryDate = new Date('2010-05-15');

    it('should call eventService.recalculateUserEvents with correct parameters', async () => {
      mockEventService.recalculateUserEvents.mockResolvedValue(undefined);

      await service.recalculateUserEvents(userId, timezone, birthday, anniversaryDate);

      expect(eventService.recalculateUserEvents).toHaveBeenCalledWith(
        userId,
        timezone,
        birthday,
        anniversaryDate,
      );
    });

    it('should not throw an error if eventService.recalculateUserEvents fails', async () => {
      const errorMessage = 'Recalculation failed';
      mockEventService.recalculateUserEvents.mockRejectedValue(new Error(errorMessage));

      
      await expect(
        service.recalculateUserEvents(userId, timezone, birthday, anniversaryDate),
      ).resolves.not.toThrow();

      
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        `[User Event Service] Error recalculating events for user ${userId}: ${errorMessage}`,
      );
    });

    it('should handle successful recalculation without error', async () => {
      mockEventService.recalculateUserEvents.mockResolvedValue(undefined);

      await expect(
        service.recalculateUserEvents(userId, timezone, birthday, anniversaryDate),
      ).resolves.toBeUndefined();
    });
  });
});
