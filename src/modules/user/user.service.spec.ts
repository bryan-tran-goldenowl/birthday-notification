import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { UserService } from './user.service';
import { User } from './schemas/user.schema';
import { TimezoneUtil } from '../../common/utils/timezone.util';
import { UserEventService } from './user-event.service';

describe('UserService', () => {
  let service: UserService;
  let model: any;

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

  const mockUserEventService = {
    recalculateUserEvents: jest.fn().mockResolvedValue(undefined),
  };

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
        { provide: UserEventService, useValue: mockUserEventService },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    model = module.get(getModelToken(User.name));

    jest.clearAllMocks();
  });

  describe('CRUD Operations', () => {
    describe('create', () => {
      it('should create user', async () => {
        const dto = { firstName: 'John', birthday: '1990-01-01', timezone: 'UTC' } as any;
        
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
      it('should update user', async () => {
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
      it('should delete user', async () => {
        mockUserModel.findByIdAndDelete = jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ _id: '1' }),
        });

        await service.remove('1');
        
        expect(mockUserModel.findByIdAndDelete).toHaveBeenCalledWith('1');
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
