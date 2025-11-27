import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { UserService } from './user.service';
import { User } from './schemas/user.schema';
import { TimezoneUtil } from '../../common/utils/timezone.util';

// Mock Redis
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  on: jest.fn(),
  quit: jest.fn(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

describe('UserService', () => {
  let service: UserService;
  let model: any;

  // Mock Data
  const mockUsers = [
    { firstName: 'Tuan', timezone: 'Australia/Sydney' },
    { firstName: 'John', timezone: 'America/New_York' },
  ];

  const mockUserModel = {
    find: jest.fn(),
    distinct: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key) => (key === 'redis.host' ? 'localhost' : 6379)),
  };

  // Mock TimezoneUtil methods that are used
  jest.spyOn(TimezoneUtil, 'getTodayMonthDay').mockImplementation((timezone) => {
    if (timezone === 'Australia/Sydney') return { month: 11, day: 26 };
    return { month: 1, day: 1 };
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    model = module.get(getModelToken(User.name));

    jest.clearAllMocks();
  });

  describe('getDistinctTimezones (Caching Logic)', () => {
    it('should query DB if cache is empty (Redis miss)', async () => {
      const timezones = ['Australia/Sydney', 'UTC'];
      mockRedis.get.mockResolvedValue(null); // Cache miss
      mockUserModel.distinct.mockReturnValue({
        exec: jest.fn().mockResolvedValue(timezones),
      });

      const result = await service.getDistinctTimezones();

      expect(mockRedis.get).toHaveBeenCalledWith('CACHE:TIMEZONES');
      expect(mockUserModel.distinct).toHaveBeenCalledWith('timezone');
      expect(mockRedis.set).toHaveBeenCalledWith(
        'CACHE:TIMEZONES',
        JSON.stringify(timezones),
        'EX',
        3600
      );
      expect(result).toEqual(timezones);
    });

    it('should return cached data without querying DB if cache exists (Redis hit)', async () => {
      const cachedTimezones = ['Cached/Zone'];
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedTimezones));

      const result = await service.getDistinctTimezones();

      expect(mockRedis.get).toHaveBeenCalledWith('CACHE:TIMEZONES');
      expect(mockUserModel.distinct).not.toHaveBeenCalled();
      expect(result).toEqual(cachedTimezones);
    });
  });

  describe('invalidateTimezoneCache', () => {
    it('should delete the cache key in Redis', async () => {
      await service.invalidateTimezoneCache();
      expect(mockRedis.del).toHaveBeenCalledWith('CACHE:TIMEZONES');
    });
  });

  describe('CRUD Operations', () => {
    describe('create', () => {
      it('should create user and invalidate cache', async () => {
        const dto = { firstName: 'John', birthday: '1990-01-01', timezone: 'UTC' } as any;
        const mockSavedUser = { _id: '123', ...dto };
        
      });
    });

    describe('findAll', () => {
      it('should return all users', async () => {
        mockUserModel.find.mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockUsers),
        });
        const result = await service.findAll();
        expect(result).toEqual(mockUsers);
      });
    });

    describe('findById', () => {
      it('should return user if found', async () => {
        mockUserModel.findById = jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockUsers[0]),
        });
        const result = await service.findById('1');
        expect(result).toEqual(mockUsers[0]);
      });

      it('should throw NotFoundException if not found', async () => {
        mockUserModel.findById = jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        });
        await expect(service.findById('999')).rejects.toThrow('not found');
      });
    });

    describe('update', () => {
      it('should update user and invalidate cache if timezone changed', async () => {
        const updateDto = { timezone: 'New/Zone' };
        mockUserModel.findByIdAndUpdate = jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ ...mockUsers[0], timezone: 'New/Zone' }),
        });

        const result = await service.update('1', updateDto as any);
        
        expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
          '1', 
          expect.objectContaining(updateDto), 
          { new: true }
        );
        expect(mockRedis.del).toHaveBeenCalledWith('CACHE:TIMEZONES'); // Cache cleared
        expect(result.timezone).toBe('New/Zone');
      });

      it('should throw NotFoundException if user not found', async () => {
        mockUserModel.findByIdAndUpdate = jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        });
        await expect(service.update('999', {})).rejects.toThrow('not found');
      });
    });

    describe('remove', () => {
      it('should delete user and invalidate cache', async () => {
        mockUserModel.findByIdAndDelete = jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ _id: '1' }),
        });

        await service.remove('1');
        
        expect(mockUserModel.findByIdAndDelete).toHaveBeenCalledWith('1');
        expect(mockRedis.del).toHaveBeenCalledWith('CACHE:TIMEZONES'); // Cache cleared
      });

      it('should throw NotFoundException if user not found', async () => {
        mockUserModel.findByIdAndDelete = jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        });
        await expect(service.remove('999')).rejects.toThrow('not found');
      });
    });

    describe('getUserStats', () => {
      it('should return total count and aggregation', async () => {
        mockUserModel.countDocuments = jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(10),
        });
        mockUserModel.aggregate = jest.fn().mockResolvedValue([{ _id: 'UTC', count: 5 }]);

        const result = await service.getUserStats();
        
        expect(result).toEqual({
          total: 10,
          byTimezone: [{ _id: 'UTC', count: 5 }],
        });
      });
    });
  });
});
