import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequiresScopes } from '../auth/decorators/requires-scopes.decorator';
import { GetApiKey } from '../auth/decorators/api-key.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { CampaignStatus } from '@prisma/client';
import { UsageLimitGuard, CheckLimit } from '../billing/usage-limit.guard';
import { EmailVerificationGuard } from '../auth/guards/email-verification.guard';

@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post()
  @RequiresScopes('campaigns:write')
  @UseGuards(UsageLimitGuard, EmailVerificationGuard)
  @CheckLimit('max_campaigns')
  @HttpCode(HttpStatus.CREATED)
  create(
    @GetUser() user: { id: string },
    @Body() createCampaignDto: CreateCampaignDto,
    @GetApiKey() apiKey?: { id: string },
  ) {
    return this.campaignService.create(user.id, createCampaignDto, { draftOnly: !!apiKey });
  }

  @Get()
  @RequiresScopes('read')
  findAll(
    @GetUser() user: { id: string },
    @Query('search') search?: string,
    @Query('status') status?: CampaignStatus,
  ) {
    return this.campaignService.findAll(user.id, search, status);
  }

  @Get('archived-and-deleted')
  @RequiresScopes('read')
  getArchivedAndDeleted(@GetUser() user: { id: string }) {
    return this.campaignService.findArchivedAndDeleted(user.id);
  }

  @Get(':id')
  @RequiresScopes('read')
  findOne(@GetUser() user: { id: string }, @Param('id') id: string) {
    return this.campaignService.findOne(user.id, id);
  }

  @Patch(':id')
  @RequiresScopes('campaigns:write')
  @UseGuards(EmailVerificationGuard)
  update(
    @GetUser() user: { id: string },
    @Param('id') id: string,
    @Body() updateCampaignDto: UpdateCampaignDto,
  ) {
    return this.campaignService.update(user.id, id, updateCampaignDto);
  }

  @Patch(':id/status')
  @RequiresScopes('campaigns:write')
  toggleStatus(
    @GetUser() user: { id: string },
    @Param('id') id: string,
    @GetApiKey() apiKey?: { id: string },
  ) {
    return this.campaignService.toggleStatus(user.id, id, { draftOnly: !!apiKey });
  }

  @Post(':id/duplicate')
  @RequiresScopes('campaigns:write')
  @UseGuards(UsageLimitGuard, EmailVerificationGuard)
  @CheckLimit('max_campaigns')
  @HttpCode(HttpStatus.CREATED)
  duplicate(@GetUser() user: { id: string }, @Param('id') id: string) {
    return this.campaignService.duplicate(user.id, id);
  }

  @Post(':id/archive')
  @RequiresScopes('campaigns:write')
  @HttpCode(HttpStatus.OK)
  archive(@GetUser() user: { id: string }, @Param('id') id: string) {
    return this.campaignService.archive(user.id, id);
  }

  @Delete(':id')
  @RequiresScopes('campaigns:write')
  @HttpCode(HttpStatus.OK)
  delete(@GetUser() user: { id: string }, @Param('id') id: string) {
    return this.campaignService.delete(user.id, id);
  }

  @Post(':id/restore')
  @RequiresScopes('campaigns:write')
  @HttpCode(HttpStatus.OK)
  restore(@GetUser() user: { id: string }, @Param('id') id: string) {
    return this.campaignService.restore(user.id, id);
  }

  @Delete(':id/permanent')
  @RequiresScopes('campaigns:write')
  @HttpCode(HttpStatus.OK)
  permanentDelete(@GetUser() user: { id: string }, @Param('id') id: string) {
    return this.campaignService.permanentDelete(user.id, id);
  }
}
