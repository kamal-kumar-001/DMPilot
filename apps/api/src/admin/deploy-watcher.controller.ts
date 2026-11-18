import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequiresScopes } from '../auth/decorators/requires-scopes.decorator';

/**
 * Host-watcher endpoints for the safe update control. These accept ONLY a
 * deploy-scoped API key: browser/admin JWTs are rejected even though the
 * JwtAuthGuard would otherwise let them through, and the key itself is
 * limited to these routes by scope. The watcher can only claim the next
 * owner-created request and report fixed status transitions.
 */
@Controller('watcher/deploy')
@UseGuards(JwtAuthGuard)
export class DeployWatcherController {
  constructor(private readonly adminService: AdminService) {}

  private assertWatcherKey(req: any) {
    if (!req.apiKey) {
      throw new ForbiddenException('Watcher endpoints require the deploy-scoped API key.');
    }
  }

  @Post('claim')
  @HttpCode(HttpStatus.OK)
  @RequiresScopes('deploy')
  claim(@Req() req: any) {
    this.assertWatcherKey(req);
    return this.adminService.claimNextDeployRequest();
  }

  @Get('active')
  @RequiresScopes('deploy')
  active(@Req() req: any) {
    this.assertWatcherKey(req);
    return this.adminService.getActiveDeployRequest();
  }

  @Post(':id/report')
  @HttpCode(HttpStatus.OK)
  @RequiresScopes('deploy')
  report(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { action: string; runId?: string; failureReason?: string; logTail?: string },
  ) {
    this.assertWatcherKey(req);
    return this.adminService.reportDeployRequest(id, body?.runId ?? '', body ?? { action: '' });
  }
}
