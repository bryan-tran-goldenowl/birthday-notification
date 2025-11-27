import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerService } from './scheduler.service';
import { UserService } from '../user/user.service';
import { EventService } from '../event/event.service';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Settings } from 'luxon';
import { EVENT_PROCESSORS } from '../../common/interfaces/event-processor.interface';

// Mock Data
const mockTimezones = ['Australia/Sydney', 'America/New_York'];
const mockFailedEvents = [
  { _id: 'event1', retryCount: 0, status: 'failed' },
  { _id: 'event2', retryCount: 1, status: 'pending' }, // Stuck pending
];

describe('SchedulerService', () => {
  let service: SchedulerService;
  let userService: UserService;
  let eventService: EventService;
  let queue: any;
  
  // Mock Processors
  const mockBirthdayProcessor = {
    getEventType: jest.fn().mockReturnValue('birthday'),
    getCheckHour: jest.fn().mockReturnValue(9),
    getUsersToProcess: jest.fn(),
  };

  // Mock implementations
  const mockUserService = {
    getDistinctTimezones: jest.fn(),
  };

  const mockEventService = {
    processEventsForTimezone: jest.fn(),
    getFailedEventsForRetry: jest.fn(),
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
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getQueueToken('notification'), useValue: mockQueue },
        { provide: EVENT_PROCESSORS, useValue: [mockBirthdayProcessor] }, // Inject mock processors
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
    userService = module.get<UserService>(UserService);
    eventService = module.get<EventService>(EventService);
    queue = module.get(getQueueToken('notification'));

    // Reset mocks
    jest.clearAllMocks();
    // Reset processor mock behavior default
    mockBirthdayProcessor.getCheckHour.mockReturnValue(9);
    
    // Silence logger during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore Luxon time
    Settings.now = () => Date.now();
  });

  describe('scheduleEvents (Main Cron)', () => {
    it('should process events for timezones that match the processor check hour', async () => {
      
      mockUserService.getDistinctTimezones.mockResolvedValue(mockTimezones);
      
      mockBirthdayProcessor.getUsersToProcess.mockResolvedValue([{ id: 1 }]);
      
      mockEventService.processEventsForTimezone.mockResolvedValue([{ _id: 'log1' }]);

      Settings.now = () => new Date('2025-11-25T22:00:00Z').valueOf();

      await service.scheduleEvents();

      expect(mockUserService.getDistinctTimezones).toHaveBeenCalled();
      
      expect(mockBirthdayProcessor.getUsersToProcess).toHaveBeenCalledWith('Australia/Sydney');
      
      expect(mockEventService.processEventsForTimezone).toHaveBeenCalled();
      
      expect(mockQueue.add).toHaveBeenCalledWith(
        'send-notification',
        { eventLogId: 'log1' },
        expect.objectContaining({ attempts: 1 })
      );
    });

    it('should NOT process timezones if they do not match check hour', async () => {
      
      mockUserService.getDistinctTimezones.mockResolvedValue(['UTC']);
      
      Settings.now = () => new Date('2025-11-26T02:00:00Z').valueOf();

      
      await service.scheduleEvents();

      
      expect(mockUserService.getDistinctTimezones).toHaveBeenCalled();
      
      expect(mockBirthdayProcessor.getUsersToProcess).not.toHaveBeenCalled();
    });
  });

  describe('scheduleEventRecovery', () => {
    it('should fetch failed events and queue them again', async () => {
      
      mockEventService.getFailedEventsForRetry.mockResolvedValue(mockFailedEvents);

        
      await service.scheduleEventRecovery();

      expect(mockEventService.getFailedEventsForRetry).toHaveBeenCalled();
      
      expect(mockQueue.add).toHaveBeenCalledTimes(2);
      
      expect(mockQueue.add).toHaveBeenCalledWith(
        'send-notification', 
        { eventLogId: 'event1' },
        expect.objectContaining({ attempts: 1 })
      );
    });

    it('should do nothing if no failed events found', async () => {
      
      mockEventService.getFailedEventsForRetry.mockResolvedValue([]);

      
      await service.scheduleEventRecovery();

      expect(mockEventService.getFailedEventsForRetry).toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('triggerBackfill', () => {
    it('should process timezones where check hour has passed', async () => {
      mockUserService.getDistinctTimezones.mockResolvedValue(['Australia/Sydney', 'UTC']);
      
      mockUserService.getDistinctTimezones.mockResolvedValue(['Australia/Sydney', 'Asia/Dhaka']);
      Settings.now = () => new Date('2025-11-25T23:00:00Z').valueOf(); // 10 AM Sydney, 05 AM Dhaka

      mockBirthdayProcessor.getUsersToProcess.mockResolvedValue([{ id: 1 }]);
      
      await service.triggerBackfill();

      expect(mockBirthdayProcessor.getUsersToProcess).toHaveBeenCalledWith('Australia/Sydney');
      expect(mockBirthdayProcessor.getUsersToProcess).not.toHaveBeenCalledWith('Asia/Dhaka');
    });
  });
});
