import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { EventService } from './event.service';
import { NotificationLog } from './schemas/notification-log.schema';
import { EventType } from '../../common/enums/event-type.enum';
import { NotificationStatus } from '../../common/enums/notification-status.enum';
import { Types } from 'mongoose';
import { EVENT_PROCESSORS } from '../../common/interfaces/event-processor.interface';


const mockUserId = new Types.ObjectId();
const mockLogId = new Types.ObjectId();

describe('EventService', () => {
  let service: EventService;
  let model: any;

  const mockNotificationLogModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    bulkWrite: jest.fn(),
    updateMany: jest.fn(),
  };

  
  const mockSave = jest.fn();

  
  class MockModel {
    constructor(public data: any) {}
  
    save() {
      return mockSave.apply(this, arguments);
    }
  }

  const mockProcessor = {
    getEventType: jest.fn().mockReturnValue(EventType.BIRTHDAY),
    generateMessage: jest.fn(),
  };

  beforeEach(async () => {
    
    mockSave.mockResolvedValue({ _id: mockLogId });
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventService,
        {
          provide: getModelToken(NotificationLog.name),
          useValue: mockNotificationLogModel,
        },
        {
          provide: EVENT_PROCESSORS,
          useValue: [mockProcessor],
        },
      ],
    }).compile();

    
    const mixedMockModel = MockModel;
    Object.assign(mixedMockModel, mockNotificationLogModel);
    
    service = module.get<EventService>(EventService);
    (service as any).notificationLogModel = mixedMockModel;

    model = service['notificationLogModel'];
    
    jest.clearAllMocks();
  });

  

  describe('processEventsForTimezone', () => {
    it('should perform bulk upsert for valid users', async () => {
      
      const users = [{ _id: mockUserId, birthday: new Date() }];
      const timezone = 'Australia/Sydney';
      const eventType = EventType.BIRTHDAY;

      mockNotificationLogModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ _id: 'log1' }]),
      });

      
      await service.processEventsForTimezone(timezone, users, eventType);

      
      expect(mockNotificationLogModel.bulkWrite).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            updateOne: expect.objectContaining({
              upsert: true,
              filter: expect.objectContaining({
                userId: mockUserId,
                eventType: EventType.BIRTHDAY,
              }),
            }),
          }),
        ]),
        expect.objectContaining({ ordered: false }),
      );
    });
  });

  describe('getFailedEventsForRetry', () => {
    it('should fetch FAILED or STUCK PENDING events and reset them to PENDING', async () => {
      const failedEvents = [
        { _id: 'ev1', status: NotificationStatus.FAILED },
        { _id: 'ev2', status: NotificationStatus.PENDING },
      ];

      mockNotificationLogModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(failedEvents),
      });

      const result = await service.getFailedEventsForRetry();

      expect(mockNotificationLogModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([
            { status: NotificationStatus.FAILED },
            { 
              status: NotificationStatus.PENDING, 
              updatedAt: expect.any(Object) 
            },
          ]),
        })
      );

      expect(mockNotificationLogModel.updateMany).toHaveBeenCalledWith(
        { _id: { $in: ['ev1', 'ev2'] } },
        { $set: { status: NotificationStatus.PENDING } }
      );

      expect(result).toEqual(failedEvents);
    });
  });

  describe('findById', () => {
    it('should return event log if found', async () => {
      const mockLog = { _id: 'log1', status: 'pending' };
      mockNotificationLogModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockLog),
      });

      const result = await service.findById('log1');
      expect(result).toEqual(mockLog);
    });

    it('should throw error if not found', async () => {
      mockNotificationLogModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findById('log1')).rejects.toThrow('not found');
    });
  });

  describe('updateEventStatus', () => {
    it('should update status to SENT with sentAt', async () => {
      mockNotificationLogModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(true),
      });

      await service.updateEventStatus('log1', NotificationStatus.SENT);

      expect(mockNotificationLogModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'log1',
        expect.objectContaining({
          status: NotificationStatus.SENT,
          sentAt: expect.any(Date),
        })
      );
    });

    it('should update status to FAILED with errorMessage and increment retryCount', async () => {
      await service.updateEventStatus('log1', NotificationStatus.FAILED, 'Error msg');

      expect(mockNotificationLogModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'log1',
        expect.objectContaining({
          status: NotificationStatus.FAILED,
          errorMessage: 'Error msg',
          $inc: { retryCount: 1 },
        })
      );
    });
  });

  describe('getMessageForEvent', () => {
    it('should return message from processor', () => {
      const eventLog = { eventType: EventType.BIRTHDAY, userId: { firstName: 'Tuan' } };
      mockProcessor.generateMessage.mockReturnValue('Happy Birthday Tuan');

      const msg = service.getMessageForEvent(eventLog);
      
      expect(mockProcessor.generateMessage).toHaveBeenCalledWith(eventLog.userId);
      expect(msg).toBe('Happy Birthday Tuan');
    });

    it('should return default message if processor not found', () => {
      const eventLog = { eventType: 'UNKNOWN_TYPE', userId: {} };
      const msg = service.getMessageForEvent(eventLog);
      expect(msg).toBe('Happy event!');
    });
  });
});
