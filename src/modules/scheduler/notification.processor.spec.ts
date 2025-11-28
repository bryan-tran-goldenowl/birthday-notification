import { Test, TestingModule } from '@nestjs/testing';
import { NotificationProcessor } from './notification.processor';
import { EventService } from '../event/event.service';
import { NotificationService } from '../notification/notification.service';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { REDIS_CLIENT } from '../../common/redis/redis.module';

const mockRedis = {
  set: jest.fn(),
  del: jest.fn(),
  on: jest.fn(),
  quit: jest.fn(),
};

describe('NotificationProcessor', () => {
  let processor: NotificationProcessor;
  let eventService: any;
  let notificationService: any;

  const mockEventService = {
    findById: jest.fn(),
    getMessageForEvent: jest.fn(),
    updateEventStatus: jest.fn(),
  };

  const mockNotificationService = {
    sendEventNotification: jest.fn(),
  };

  // Mock Job
  const mockJob = {
    id: 'job1',
    data: { eventLogId: 'log1' },
  } as unknown as Job<{ eventLogId: string }>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationProcessor,
        { provide: EventService, useValue: mockEventService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    processor = module.get<NotificationProcessor>(NotificationProcessor);
    eventService = module.get<EventService>(EventService);
    notificationService = module.get<NotificationService>(NotificationService);

    jest.clearAllMocks();
    
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  describe('handleSendNotification', () => {
    it('should skip execution if lock is not acquired', async () => {
   
      mockRedis.set.mockResolvedValue(null);

   
      await processor.handleSendNotification(mockJob);

   
      expect(mockRedis.set).toHaveBeenCalled();
      expect(eventService.findById).not.toHaveBeenCalled(); 
    });

    it('should skip execution if status is already SENT', async () => {
      
      mockRedis.set.mockResolvedValue('OK');
      
      
      mockEventService.findById.mockResolvedValue({ 
        _id: 'log1', 
        status: 'sent' 
      });

      
      await processor.handleSendNotification(mockJob);

      
      expect(notificationService.sendEventNotification).not.toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should send notification and update status to SENT on success', async () => {
      
      mockRedis.set.mockResolvedValue('OK');
      mockEventService.findById.mockResolvedValue({ 
        _id: 'log1', 
        status: 'pending',
        userId: { firstName: 'Tuan' }
      });
      mockEventService.getMessageForEvent.mockReturnValue('Happy Birthday');
      mockNotificationService.sendEventNotification.mockResolvedValue(true); 

      
      await processor.handleSendNotification(mockJob);

      
      expect(notificationService.sendEventNotification).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 'log1' }),
        'Happy Birthday'
      );
      expect(mockEventService.updateEventStatus).toHaveBeenCalledWith(
        'log1',
        'sent'
      );
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should update status to FAILED and throw error on failure', async () => {
      
      mockRedis.set.mockResolvedValue('OK');
      mockEventService.findById.mockResolvedValue({ 
        _id: 'log1', 
        status: 'pending' 
      });
      mockNotificationService.sendEventNotification.mockResolvedValue(false); 

      
      await expect(processor.handleSendNotification(mockJob)).rejects.toThrow('Notification sending failed');

      expect(mockEventService.updateEventStatus).toHaveBeenCalledWith(
        'log1',
        'failed',
        expect.any(String)
      );
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });
});
