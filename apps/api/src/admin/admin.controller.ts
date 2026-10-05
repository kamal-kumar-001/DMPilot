import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, CampaignStatus, Plan } from '@prisma/client';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ─── Creators ────────────────────────────────────────────────────

  @Get('creators')
  getCreators(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getCreators({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
    });
  }

  @Post('creators/:id/suspend')
  @HttpCode(HttpStatus.OK)
  suspend(@Param('id') id: string) {
    return this.adminService.suspendUser(id);
  }

  @Post('creators/:id/unsuspend')
  @HttpCode(HttpStatus.OK)
  unsuspend(@Param('id') id: string) {
    return this.adminService.unsuspendUser(id);
  }

  @Patch('creators/:id/plan')
  changePlan(@Param('id') id: string, @Body('plan') plan: Plan) {
    return this.adminService.changePlan(id, plan);
  }

  // ─── Campaigns ───────────────────────────────────────────────────

  @Get('campaigns')
  getCampaigns(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: CampaignStatus,
  ) {
    return this.adminService.getCampaigns({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      status,
    });
  }

  // ─── Audit Logs ──────────────────────────────────────────────────

  @Get('logs')
  getAuditLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
  ) {
    return this.adminService.getAuditLogs({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 30,
      userId,
      action,
    });
  }

  @Delete('logs')
  deleteAuditLogs(@Query('olderThan') olderThan: string) {
    return this.adminService.deleteAuditLogs(olderThan);
  }

  @Get('logs/download')
  async downloadAuditLogs(
    @Res() res: Response,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
  ) {
    const logs = await this.adminService.getAllAuditLogs({ userId, action });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');

    const csvHeader = 'ID,User Email,Action,Details,IP Address,Created At\n';
    const csvRows = logs.map((log) => {
      const email = log.user?.email || 'system';
      const details = (log.details || '').replace(/"/g, '""');
      return `"${log.id}","${email}","${log.action}","${details}","${log.ipAddress || ''}","${log.createdAt.toISOString()}"`;
    });

    return res.status(HttpStatus.OK).send(csvHeader + csvRows.join('\n'));
  }

  // ─── Feature Flags ───────────────────────────────────────────────

  @Get('flags')
  getFlags() {
    return this.adminService.getFeatureFlags();
  }

  @Patch('flags/:key/toggle')
  toggleFlag(@Param('key') key: string, @Body('isEnabled') isEnabled: boolean) {
    return this.adminService.toggleFeatureFlag(key, isEnabled);
  }

  @Patch('flags/:key/plans')
  updateFlagPlans(@Param('key') key: string, @Body('plans') plans: Plan[]) {
    return this.adminService.updateFlagPlans(key, plans);
  }

  // ─── Queue ───────────────────────────────────────────────────────

  @Get('queues')
  getQueues() {
    return this.adminService.getQueueStats();
  }

  @Get('failed-jobs')
  getFailedJobs(@Query('limit') limit?: string) {
    return this.adminService.getFailedJobs(limit ? parseInt(limit, 10) : 50);
  }

  @Post('failed-jobs/:queue/:jobId/retry')
  @HttpCode(HttpStatus.OK)
  retryJob(@Param('queue') queue: string, @Param('jobId') jobId: string) {
    return this.adminService.retryJob(queue, jobId);
  }

  // ─── Delete Requests ─────────────────────────────────────────────

  @Get('delete-requests')
  getDeleteRequests(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.adminService.getDeleteRequests({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Post('delete-requests/approve')
  @HttpCode(HttpStatus.OK)
  approveDeleteRequests(@Body('ids') ids: string[]) {
    return this.adminService.approveDeleteRequests(ids);
  }

  @Post('delete-requests/reject')
  @HttpCode(HttpStatus.OK)
  rejectDeleteRequests(@Body('ids') ids: string[]) {
    return this.adminService.rejectDeleteRequests(ids);
  }

  @Post('delete-requests/meta-bulk-purge')
  @HttpCode(HttpStatus.OK)
  bulkDeleteByMetaIds(@Body('ids') ids: string[]) {
    return this.adminService.bulkDeleteByMetaIds(ids || []);
  }

  // ─── System Health ───────────────────────────────────────────────

  @Get('health')
  getHealth() {
    return this.adminService.getSystemHealth();
  }

  @Get('metrics')
  getMetrics() {
    return this.adminService.getSystemMetrics();
  }

  @Get('stats')
  getStats() {
    return this.adminService.getSaaSStats();
  }

  @Post('enable-app-review-mode')
  @HttpCode(HttpStatus.OK)
  enableAppReviewMode() {
    return this.adminService.enableAppReviewMode();
  }

  // ─── Billing Plans ───────────────────────────────────────────────

  @Get('plans')
  getBillingPlans() {
    return this.adminService.getBillingPlans();
  }

  @Patch('plans/:key')
  updatePlan(
    @Param('key') key: Plan,
    @Body()
    body: {
      name?: string;
      description?: string;
      priceMonthly?: number;
      priceYearly?: number;
      campaignLimit?: number;
      keywordLimit?: number;
      dmLimitMonthly?: number;
    },
  ) {
    return this.adminService.updateBillingPlan(key, body);
  }

  // ─── Promo Settings ──────────────────────────────────────────────

  @Get('promo')
  getPromo() {
    return this.adminService.getPromoSettings();
  }

  @Post('promo')
  updatePromo(
    @Body()
    body: {
      text: string;
      enabled: boolean;
      discountPercent: number;
    },
  ) {
    return this.adminService.updatePromoSettings(body);
  }

  @Get('support-tickets')
  getSupportTickets() {
    return this.adminService.getSupportTickets();
  }

  @Patch('support-tickets/:id/resolve')
  resolveSupportTicket(@Param('id') id: string) {
    return this.adminService.resolveSupportTicket(id);
  }
}
