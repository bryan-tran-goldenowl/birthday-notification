import { Test, TestingModule } from '@nestjs/testing';
import { EventDispatcherService } from './event-dispatcher.service';
import { EventService } from '../event/event.service';
import { getQueueToken } from '@nestjs/bull';
import { Logger } from '@nestjs/common';

describe('EventDispatcherService', () => {
  let service: EventDispatcherService;
  let eventService: any;
  let notificationQueue: any;

  const mockEventService = {
    findEventsDueForDispatch: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventDispatcherService,
        { provide: EventService, useValue: mockEventService },
        { provide: getQueueToken('notification'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<EventDispatcherService>(EventDispatcherService);
    eventService = module.get<EventService>(EventService);
    notificationQueue = module.get(getQueueToken('notification'));

    jest.clearAllMocks();
    
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  describe('dispatchEvents', () => {
    it('should return early if no events are due', async () => {
      mockEventService.findEventsDueForDispatch.mockResolvedValue([]);

      await service.dispatchEvents();

      expect(eventService.findEventsDueForDispatch).toHaveBeenCalled();
      expect(notificationQueue.add).not.toHaveBeenCalled();
    });

    it('should dispatch events to the queue with correct jobId', async () => {
      const mockEvents = [
        { _id: 'event1', userId: 'user1' },
        { _id: 'event2', userId: 'user2' },
      ];
      mockEventService.findEventsDueForDispatch.mockResolvedValue(mockEvents);
      mockQueue.add.mockResolvedValue(null);

      await service.dispatchEvents();

      expect(eventService.findEventsDueForDispatch).toHaveBeenCalled();
      expect(notificationQueue.add).toHaveBeenCalledTimes(2);
      
      
      expect(notificationQueue.add).toHaveBeenCalledWith(
        'send-notification',
        { eventLogId: 'event1' },
        expect.objectContaining({
          jobId: 'event1',
          attempts: 1,
          removeOnComplete: true,
          removeOnFail: true,
        })
      );

      
      expect(notificationQueue.add).toHaveBeenCalledWith(
        'send-notification',
        { eventLogId: 'event2' },
        expect.objectContaining({
          jobId: 'event2',
        })
      );
    });

    it('should log and throw error if dispatch fails', async () => {
      mockEventService.findEventsDueForDispatch.mockRejectedValue(new Error('DB Error'));

      await expect(service.dispatchEvents()).rejects.toThrow('DB Error');
    });
  });
});
