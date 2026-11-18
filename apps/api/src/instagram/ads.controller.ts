import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequiresScopes } from '../auth/decorators/requires-scopes.decorator';
import { GetApiKey } from '../auth/decorators/api-key.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { AdsManagementService } from './ads-management.service';
import { CreateAdCampaignDto } from './dto/content-publish.dto';

@Controller('ads')
@UseGuards(JwtAuthGuard)
export class AdsController {
  constructor(private readonly adsManagementService: AdsManagementService) {}

  @Post('boost')
  @RequiresScopes('ads:write')
  @HttpCode(HttpStatus.CREATED)
  async createBoostCampaign(@GetUser() user: { id: string }, @Body() dto: CreateAdCampaignDto) {
    return this.adsManagementService.createBoostCampaign(user.id, dto);
  }

  @Get()
  @RequiresScopes('read')
  async listCampaigns(
    @GetUser() user: { id: string },
    @Query('accountId') accountId?: string,
    @GetApiKey() apiKey?: { instagramAccountIds: string[] },
  ) {
    return this.adsManagementService.listCampaigns(user.id, accountId, apiKey?.instagramAccountIds);
  }

  @Get('summary')
  @RequiresScopes('read')
  async getAdsSummary(@GetUser() user: { id: string }) {
    return this.adsManagementService.getAdsSummary(user.id);
  }

  @Patch(':id/status')
  @RequiresScopes('ads:write')
  async updateStatus(
    @GetUser() user: { id: string },
    @Param('id') campaignId: string,
    @Body('status') status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED',
  ) {
    return this.adsManagementService.updateStatus(user.id, campaignId, status);
  }
}
