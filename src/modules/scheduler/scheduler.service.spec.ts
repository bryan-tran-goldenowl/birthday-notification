import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerService } from './scheduler.service';
import { UserService } from '../user/user.service';
import { EventService } from '../event/event.service';
import { EventGeneratorService } from './event-generator.service';
import { EventDispatcherService } from './event-dispatcher.service';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Settings } from 'luxon';
import { REDIS_CLIENT } from '../../common/redis/redis.module';


const mockTimezones = ['Australia/Sydney', 'America/New_York'];
const mockFailedEvents = [
  { _id: 'event1', retryCount: 0, status: 'failed' },
  { _id: 'event2', retryCount: 1, status: 'pending' },
];

const mockRedis = {
  set: jest.fn(),
  del: jest.fn(),
  on: jest.fn(),
};

describe('SchedulerService', () => {
  let service: SchedulerService;
  let userService: UserService;
  let eventService: EventService;
  let eventGeneratorService: EventGeneratorService;
  let eventDispatcherService: EventDispatcherService;
  let queue: any;
  
 
  const mockUserService = {
    getDistinctTimezones: jest.fn(),
  };

  const mockEventService = {
    processEventsForTimezone: jest.fn(),
    getFailedEventsForRetry: jest.fn(),
  };

  const mockEventGeneratorService = {
    generateEvents: jest.fn(),
  };

  const mockEventDispatcherService = {
    dispatchEvents: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key, defaultValue) => defaultValue),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: UserService, useValue: mockUserService },
        { provide: EventService, useValue: mockEventService },
        { provide: EventGeneratorService, useValue: mockEventGeneratorService },
        { provide: EventDispatcherService, useValue: mockEventDispatcherService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getQueueToken('notification'), useValue: mockQueue },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
    userService = module.get<UserService>(UserService);
    eventService = module.get<EventService>(EventService);
    eventGeneratorService = module.get<EventGeneratorService>(EventGeneratorService);
    eventDispatcherService = module.get<EventDispatcherService>(EventDispatcherService);
    queue = module.get(getQueueToken('notification'));

    
    jest.clearAllMocks();
    mockRedis.set.mockResolvedValue('OK');
    
    
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    
    Settings.now = () => Date.now();
  });

  describe('generateEvents (Cron)', () => {
    it('should call eventGeneratorService.generateEvents', async () => {
      await service.generateEvents();
      expect(mockEventGeneratorService.generateEvents).toHaveBeenCalled();
    });
  });

  describe('dispatchEvents (Cron)', () => {
    it('should call eventDispatcherService.dispatchEvents', async () => {
      await service.dispatchEvents();
      expect(mockEventDispatcherService.dispatchEvents).toHaveBeenCalled();
    });
  });

  describe('scheduleEventRecovery', () => {
    it('should fetch failed events and queue them again', async () => {
      
      mockEventService.getFailedEventsForRetry.mockResolvedValue(mockFailedEvents);

      
      await service.scheduleEventRecovery();

      
      expect(mockRedis.set).toHaveBeenCalled();
      expect(mockEventService.getFailedEventsForRetry).toHaveBeenCalled();
      
      
      expect(mockQueue.add).toHaveBeenCalledTimes(2);
      
      
      expect(mockQueue.add).toHaveBeenCalledWith(
        'send-notification', 
        { eventLogId: 'event1' },
        expect.objectContaining({ attempts: 1 })
      );
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should do nothing if no failed events found', async () => {
      
      mockEventService.getFailedEventsForRetry.mockResolvedValue([]);

      
      await service.scheduleEventRecovery();

      expect(mockRedis.set).toHaveBeenCalled();
      expect(mockEventService.getFailedEventsForRetry).toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalled();
    });
    
    it('should skip if lock is already held', async () => {
      mockRedis.set.mockResolvedValue(null);
      
      await service.scheduleEventRecovery();
      
      expect(mockRedis.set).toHaveBeenCalled();
      expect(mockEventService.getFailedEventsForRetry).not.toHaveBeenCalled();
    });
  });

  describe('Manual Triggers', () => {
    it('should trigger generation manually', async () => {
      await service.triggerGeneration();
      expect(mockEventGeneratorService.generateEvents).toHaveBeenCalled();
    });

    it('should trigger dispatch manually', async () => {
      await service.triggerDispatch();
      expect(mockEventDispatcherService.dispatchEvents).toHaveBeenCalled();
    });
  });
});