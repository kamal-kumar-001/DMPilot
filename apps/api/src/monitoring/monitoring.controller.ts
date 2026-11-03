import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { FeatureGateGuard, RequiresFeature } from '../billing/feature-gate.guard';

@Controller('monitoring')
@UseGuards(JwtAuthGuard)
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  /** GET /monitoring/health — API, DB, Redis liveness */
  @Get('health')
  getHealth() {
    return this.monitoringService.getHealth();
  }

  /** GET /monitoring/queues — BullMQ queue stats */
  @Get('queues')
  getQueueStats() {
    return this.monitoringService.getQueueStats();
  }

  /** GET /monitoring/failed-jobs — list failed jobs across all queues */
  @Get('failed-jobs')
  getFailedJobs(@Query('limit') limit?: string) {
    return this.monitoringService.getFailedJobs(limit ? parseInt(limit, 10) : 50);
  }

  /** POST /monitoring/failed-jobs/:queue/:jobId/retry — retry a specific failed job */
  @Post('failed-jobs/:queue/:jobId/retry')
  @HttpCode(HttpStatus.OK)
  retryJob(@Param('queue') queue: string, @Param('jobId') jobId: string) {
    return this.monitoringService.retryFailedJob(queue, jobId);
  }

  /** DELETE /monitoring/failed-jobs — purge failed jobs across all queues with timeframe filter */
  @Delete('failed-jobs')
  purgeFailedJobs(@Query('olderThan') olderThan?: string) {
    return this.monitoringService.purgeFailedJobs(olderThan);
  }

  /** GET /monitoring/webhook-logs — paginated webhook event history scoped to user/creator */
  @Get('webhook-logs')
  @UseGuards(FeatureGateGuard)
  @RequiresFeature('WEBHOOK_LOGS')
  getWebhookLogs(
    @GetUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const isStaff = user?.role === 'ADMIN';
    return this.monitoringService.getWebhookLogs(
      user?.id,
      isStaff,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  /** GET /monitoring/delivery-logs — rich commenter delivery log for creator dashboard */
  @Get('delivery-logs')
  getDeliveryLogs(
    @GetUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const isStaff = user?.role === 'ADMIN';
    return this.monitoringService.getDeliveryLogs(
      user?.id,
      isStaff,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  /** GET /monitoring/metrics — Node.js process / system metrics */
  @Get('metrics')
  getMetrics() {
    return this.monitoringService.getSystemMetrics();
  }

  /** GET /monitoring/webhook-status — check if webhook routing is paused */
  @Get('webhook-status')
  getWebhookStatus() {
    return this.monitoringService.getWebhookStatus();
  }

  /** POST /monitoring/webhook-status — pause/resume webhook processing */
  @Post('webhook-status')
  @HttpCode(HttpStatus.OK)
  updateWebhookStatus(@Body() body: { paused: boolean }) {
    return this.monitoringService.updateWebhookStatus(body.paused);
  }

  /** DELETE /monitoring/webhook-logs — purge webhook logs with timeframe filter */
  @Delete('webhook-logs')
  purgeWebhookLogs(@Query('olderThan') olderThan?: string) {
    return this.monitoringService.purgeWebhookLogs(olderThan);
  }
}
