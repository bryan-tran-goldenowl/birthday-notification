import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SchedulerService } from './scheduler.service';

@ApiTags('scheduler')
@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Post('trigger-events')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger event check (for testing)' })
  @ApiResponse({ status: 200, description: 'Event check triggered' })
  async triggerEvents() {
    return await this.schedulerService.triggerEventCheck();
  }

  @Post('trigger-recover')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger recovery (for testing)' })
  @ApiResponse({ status: 200, description: 'Recovery triggered' })
  async triggerRecover() {
    return await this.schedulerService.scheduleEventRecovery();
  }

  @Post('trigger-backfill')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually trigger backfill/catch-up for missed events today',
  })
  @ApiResponse({ status: 200, description: 'Backfill triggered successfully' })
  async triggerBackfill() {
    return await this.schedulerService.triggerBackfill();
  }
}
