import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SchedulerService } from './scheduler.service';

@ApiTags('scheduler')
@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Post('trigger-generation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger event generation (for testing)' })
  @ApiResponse({ status: 200, description: 'Event generation triggered' })
  async triggerGeneration() {
    return await this.schedulerService.triggerGeneration();
  }

  @Post('trigger-dispatch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger event dispatch (for testing)' })
  @ApiResponse({ status: 200, description: 'Event dispatch triggered' })
  async triggerDispatch() {
    return await this.schedulerService.triggerDispatch();
  }

  @Post('trigger-recovery')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger failed event recovery (for testing)' })
  @ApiResponse({ status: 200, description: 'Recovery triggered' })
  async triggerRecovery() {
    return await this.schedulerService.scheduleEventRecovery();
  }
}
