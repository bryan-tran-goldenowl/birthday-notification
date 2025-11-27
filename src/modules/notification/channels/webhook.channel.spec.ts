import { Test, TestingModule } from '@nestjs/testing';
import { WebhookChannel } from './webhook.channel';
import axios from 'axios';

import { ConfigService } from '@nestjs/config';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WebhookChannel', () => {
  let channel: WebhookChannel;

  const mockConfigService = {
    get: jest.fn().mockReturnValue('https://hookbin.com/X118qA6W6NI226GG22zJ'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookChannel,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    channel = module.get<WebhookChannel>(WebhookChannel);
    jest.clearAllMocks();
  });

  describe('send', () => {
    it('should return true when axios post succeeds', async () => {
      mockedAxios.post.mockResolvedValue({ status: 200, data: {} });

      const result = await channel.send(
        'Hello World',
        { someData: 123 }
      );

      expect(result).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://hookbin.com/X118qA6W6NI226GG22zJ',
        expect.objectContaining({
          message: 'Hello World',
          someData: 123
        }),
        expect.any(Object)
      );
    });

    it('should return false when axios post fails', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network Error'));

      const result = await channel.send(
        'Hello World',
        {}
      );

      expect(result).toBe(false);
    });
  });
});
