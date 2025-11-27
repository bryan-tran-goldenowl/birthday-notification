import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { WebhookChannel } from './channels/webhook.channel';

describe('NotificationService', () => {
  let service: NotificationService;
  let webhookChannel: any;

  const mockWebhookChannel = {
    send: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: WebhookChannel, useValue: mockWebhookChannel },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    webhookChannel = module.get<WebhookChannel>(WebhookChannel);
    jest.clearAllMocks();
  });

  describe('sendEventNotification', () => {
    it('should use WebhookChannel to send message', async () => {
      mockWebhookChannel.send.mockResolvedValue(true);

      const eventLog = { 
        _id: '1',
        userId: { _id: 'user1', toString: () => 'user1' },
        eventType: 'birthday',
        eventYear: 2025
      };
      const message = 'Happy Birthday';

      const result = await service.sendEventNotification(eventLog as any, message);

      expect(mockWebhookChannel.send).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          userId: 'user1',
          eventLogId: '1'
        })
      );
      expect(result).toBe(true);
    });
  });
});
