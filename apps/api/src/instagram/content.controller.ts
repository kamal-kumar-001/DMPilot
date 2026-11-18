import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequiresScopes } from '../auth/decorators/requires-scopes.decorator';
import { GetApiKey } from '../auth/decorators/api-key.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ContentPublishService } from './content-publish.service';
import { CreatePublishDto } from './dto/content-publish.dto';
import { GeneratePresignedUrlDto } from './dto/presigned-url.dto';

@Controller('content')
@UseGuards(JwtAuthGuard)
export class ContentController {
  constructor(private readonly contentPublishService: ContentPublishService) {}

  @Post('presigned-url')
  @RequiresScopes('content:publish')
  @HttpCode(HttpStatus.OK)
  async getPresignedUploadUrl(
    @GetUser() user: { id: string },
    @Body() dto: GeneratePresignedUrlDto,
  ) {
    return this.contentPublishService.generatePresignedUploadUrl(user.id, dto);
  }

  @Post('publish')
  @RequiresScopes('content:publish')
  @HttpCode(HttpStatus.CREATED)
  async publishMedia(
    @GetUser() user: { id: string },
    @Body() dto: CreatePublishDto,
    @GetApiKey() apiKey?: { id: string },
  ) {
    return this.contentPublishService.publishMedia(user.id, dto, { draftOnly: !!apiKey });
  }

  @Get()
  @RequiresScopes('read')
  async listPublished(
    @GetUser() user: { id: string },
    @Query('accountId') accountId?: string,
    @GetApiKey() apiKey?: { instagramAccountIds: string[] },
  ) {
    return this.contentPublishService.listPublished(
      user.id,
      accountId,
      apiKey?.instagramAccountIds,
    );
  }

  @Delete(':id')
  @RequiresScopes('content:publish')
  async cancelPost(@GetUser() user: { id: string }, @Param('id') postId: string) {
    return this.contentPublishService.cancelPost(user.id, postId);
  }
}
