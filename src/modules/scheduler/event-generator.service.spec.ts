import { Test, TestingModule } from '@nestjs/testing';
import { EventGeneratorService } from './event-generator.service';
import { EventService } from '../event/event.service';
import { getModelToken } from '@nestjs/mongoose';
import { User } from '../user/schemas/user.schema';
import { EVENT_PROCESSORS } from '../../common/interfaces/event-processor.interface';
import { EventType } from '../../common/enums/event-type.enum';
import { REDIS_CLIENT } from '../../common/redis/redis.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

const mockBirthdayProcessor = {
  getEventType: () => EventType.BIRTHDAY,
  getCheckHour: () => 9,
  generateMessage: (user) => `HBD ${user.firstName}`,
};

const mockUser = {
  _id: 'user1',
  firstName: 'John',
  timezone: 'America/New_York',
  birthday: new Date('1990-12-25'),
};

const mockRedis = {
  set: jest.fn(),
  del: jest.fn(),
  on: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key, defaultValue) => defaultValue),
};

describe('EventGeneratorService (Date-Centric)', () => {
  let service: EventGeneratorService;
  let eventService: EventService;
  let userModel: any;

  const mockEventService = {
    bulkUpsertEvents: jest.fn(),
  };

  const mockCursor = {
    [Symbol.asyncIterator]: jest.fn(),
  };

  const mockUserModel = {
    find: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    cursor: jest.fn().mockReturnValue(mockCursor),
    distinct: jest.fn(), 
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventGeneratorService,
        {
          provide: EventService,
          useValue: mockEventService,
        },
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: EVENT_PROCESSORS,
          useValue: [mockBirthdayProcessor],
        },
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EventGeneratorService>(EventGeneratorService);
    eventService = module.get<EventService>(EventService);
    userModel = module.get(getModelToken(User.name));

    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should generate events by iterating days (Date-Centric)', async () => {
    mockRedis.set.mockResolvedValue('OK');
    
    const mockDate = new Date('2023-12-20T00:00:00Z');
    jest.useFakeTimers().setSystemTime(mockDate);

    
    mockCursor[Symbol.asyncIterator] = async function* () {
      yield mockUser;
    };

    
    await service.generateEvents();

    
    expect(userModel.distinct).not.toHaveBeenCalled();
    
    expect(mockRedis.set).toHaveBeenCalled();

    expect(userModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $expr: expect.objectContaining({
          $and: expect.arrayContaining([
             { $eq: [{ $month: '$birthday' }, expect.any(Number)] },
             { $eq: [{ $dayOfMonth: '$birthday' }, expect.any(Number)] }
          ])
        })
      })
    );

    
    expect(mockEventService.bulkUpsertEvents).toHaveBeenCalled();
    
    
    const calls = mockEventService.bulkUpsertEvents.mock.calls;
    const flatOps = calls.flat(); 
    
    expect(flatOps.length).toBeGreaterThan(0);
    
    expect(mockRedis.del).toHaveBeenCalled();
  });
});
