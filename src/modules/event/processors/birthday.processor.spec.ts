import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { BirthdayProcessor } from './birthday.processor';
import { User } from '../../user/schemas/user.schema';
import { Settings } from 'luxon';

describe('BirthdayProcessor', () => {
  let processor: BirthdayProcessor;
  let userModel: any;

  const mockUserModel = {
    find: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key, defaultValue) => defaultValue),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BirthdayProcessor,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    processor = module.get<BirthdayProcessor>(BirthdayProcessor);
    userModel = module.get(getModelToken(User.name));
    
    jest.clearAllMocks();
  });

  afterEach(() => {
    
    Settings.now = () => Date.now();
  });

  describe('getUsersToProcess', () => {
    it('should query users with birthday matching today in timezone', async () => {
      const timezone = 'Australia/Sydney';
      
      Settings.now = () => new Date('2025-11-25T23:00:00Z').valueOf();

      mockUserModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ firstName: 'Tuan' }]),
      });

      const result = await processor.getUsersToProcess(timezone);

      expect(mockUserModel.find).toHaveBeenCalledWith({
        timezone,
        $expr: {
          $and: [
            { $eq: [{ $month: '$birthday' }, 11] }, 
            { $eq: [{ $dayOfMonth: '$birthday' }, 26] },
          ],
        },
      });
      
      expect(result).toHaveLength(1);
    });
  });

  describe('generateMessage', () => {
    it('should generate correct message format', () => {
      const user = {
        firstName: 'Tuan',
        lastName: 'Nguyen',
        fullName: 'Tuan Nguyen',
      };
      
      const msg = processor.generateMessage(user);
      expect(msg).toBe("Hey, Tuan Nguyen it's your birthday");
    });

    it('should fallback to first/last name if fullName missing', () => {
      const user = {
        firstName: 'Tuan',
        lastName: 'Nguyen',
      };
      
      const msg = processor.generateMessage(user);
      expect(msg).toBe("Hey, Tuan Nguyen it's your birthday");
    });
  });
});
