import { Controller, Post, Body, Query, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('test')
@Controller('test-webhook')
export class TestWebhookController {
  private readonly logger = new Logger(TestWebhookController.name);
  private static requestCount = 0;

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Simulate a webhook endpoint with intermittent failures' })
  @ApiResponse({ status: 200, description: 'Webhook received successfully' })
  @ApiResponse({ status: 500, description: 'Simulated internal server error' })
  handleWebhook(
    @Body() payload: any,
    
  ): any {
    TestWebhookController.requestCount++;
    const count = TestWebhookController.requestCount;

    // uncomment to simulate intermittent failures
    // if (count % 3 === 0) {
    //   this.logger.error(`[Simulated Fail] Intermittent error (Req #${count}).`);
    //   throw new Error(`Simulated Intermittent Failure (Req #${count})`);
    // }

    this.logger.log(`[Webhook Success] Req #${count}. Payload: ${JSON.stringify(payload)}`);
    return {
      status: 'success',
      requestCount: count,
      receivedAt: new Date().toISOString(),
      payload: payload,
    };
  }
}
