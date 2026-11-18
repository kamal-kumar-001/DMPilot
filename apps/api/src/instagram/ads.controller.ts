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
import { GetUser } from '../auth/decorators/get-user.decorator';
import { AdsManagementService } from './ads-management.service';
import { CreateAdCampaignDto } from './dto/content-publish.dto';

@Controller('ads')
@UseGuards(JwtAuthGuard)
export class AdsController {
  constructor(private readonly adsManagementService: AdsManagementService) {}

  @Post('boost')
  @HttpCode(HttpStatus.CREATED)
  async createBoostCampaign(@GetUser() user: { id: string }, @Body() dto: CreateAdCampaignDto) {
    return this.adsManagementService.createBoostCampaign(user.id, dto);
  }

  @Get()
  async listCampaigns(@GetUser() user: { id: string }, @Query('accountId') accountId?: string) {
    return this.adsManagementService.listCampaigns(user.id, accountId);
  }

  @Get('summary')
  async getAdsSummary(@GetUser() user: { id: string }) {
    return this.adsManagementService.getAdsSummary(user.id);
  }

  @Patch(':id/status')
  async updateStatus(
    @GetUser() user: { id: string },
    @Param('id') campaignId: string,
    @Body('status') status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED',
  ) {
    return this.adsManagementService.updateStatus(user.id, campaignId, status);
  }
}
