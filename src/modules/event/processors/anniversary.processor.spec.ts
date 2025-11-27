import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AnniversaryProcessor } from './anniversary.processor';
import { User } from '../../user/schemas/user.schema';
import { Settings } from 'luxon';

describe('AnniversaryProcessor', () => {
  let processor: AnniversaryProcessor;
  let userModel: any;

  const mockUserModel = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnniversaryProcessor,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
      ],
    }).compile();

    processor = module.get<AnniversaryProcessor>(AnniversaryProcessor);
    userModel = module.get(getModelToken(User.name));
    jest.clearAllMocks();
  });

  afterEach(() => {
    Settings.now = () => Date.now();
  });

  describe('getUsersToProcess', () => {
    it('should query users with anniversary matching today in timezone', async () => {
      const timezone = 'Australia/Sydney';
      
      Settings.now = () => new Date('2025-12-24T23:00:00Z').valueOf();

      mockUserModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ firstName: 'Tuan' }]),
      });

      await processor.getUsersToProcess(timezone);

      expect(mockUserModel.find).toHaveBeenCalledWith({
        timezone,
        anniversaryDate: { $exists: true, $ne: null },
        $expr: {
          $and: [
            { $eq: [{ $month: '$anniversaryDate' }, 12] },
            { $eq: [{ $dayOfMonth: '$anniversaryDate' }, 25] },
          ],
        },
      });
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
      expect(msg).toBe("Happy Anniversary, Tuan Nguyen!");
    });
  });
});
