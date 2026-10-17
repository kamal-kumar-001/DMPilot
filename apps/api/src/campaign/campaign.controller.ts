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
import { GetUser } from '../auth/decorators/get-user.decorator';
import { CampaignStatus } from '@prisma/client';
import { UsageLimitGuard, CheckLimit } from '../billing/usage-limit.guard';
import { EmailVerificationGuard } from '../auth/guards/email-verification.guard';

@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post()
  @UseGuards(UsageLimitGuard, EmailVerificationGuard)
  @CheckLimit('max_campaigns')
  @HttpCode(HttpStatus.CREATED)
  create(@GetUser() user: { id: string }, @Body() createCampaignDto: CreateCampaignDto) {
    return this.campaignService.create(user.id, createCampaignDto);
  }

  @Get()
  findAll(
    @GetUser() user: { id: string },
    @Query('search') search?: string,
    @Query('status') status?: CampaignStatus,
  ) {
    return this.campaignService.findAll(user.id, search, status);
  }

  @Get('archived-and-deleted')
  getArchivedAndDeleted(@GetUser() user: { id: string }) {
    return this.campaignService.findArchivedAndDeleted(user.id);
  }

  @Get(':id')
  findOne(@GetUser() user: { id: string }, @Param('id') id: string) {
    return this.campaignService.findOne(user.id, id);
  }

  @Patch(':id')
  @UseGuards(EmailVerificationGuard)
  update(
    @GetUser() user: { id: string },
    @Param('id') id: string,
    @Body() updateCampaignDto: UpdateCampaignDto,
  ) {
    return this.campaignService.update(user.id, id, updateCampaignDto);
  }

  @Patch(':id/status')
  toggleStatus(@GetUser() user: { id: string }, @Param('id') id: string) {
    return this.campaignService.toggleStatus(user.id, id);
  }

  @Post(':id/duplicate')
  @UseGuards(UsageLimitGuard, EmailVerificationGuard)
  @CheckLimit('max_campaigns')
  @HttpCode(HttpStatus.CREATED)
  duplicate(@GetUser() user: { id: string }, @Param('id') id: string) {
    return this.campaignService.duplicate(user.id, id);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  archive(@GetUser() user: { id: string }, @Param('id') id: string) {
    return this.campaignService.archive(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  delete(@GetUser() user: { id: string }, @Param('id') id: string) {
    return this.campaignService.delete(user.id, id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  restore(@GetUser() user: { id: string }, @Param('id') id: string) {
    return this.campaignService.restore(user.id, id);
  }

  @Delete(':id/permanent')
  @HttpCode(HttpStatus.OK)
  permanentDelete(@GetUser() user: { id: string }, @Param('id') id: string) {
    return this.campaignService.permanentDelete(user.id, id);
  }
}
