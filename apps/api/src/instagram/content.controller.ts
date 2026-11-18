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
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ContentPublishService } from './content-publish.service';
import { CreatePublishDto } from './dto/content-publish.dto';

@Controller('content')
@UseGuards(JwtAuthGuard)
export class ContentController {
  constructor(private readonly contentPublishService: ContentPublishService) {}

  @Post('publish')
  @HttpCode(HttpStatus.CREATED)
  async publishMedia(@GetUser() user: { id: string }, @Body() dto: CreatePublishDto) {
    return this.contentPublishService.publishMedia(user.id, dto);
  }

  @Get()
  async listPublished(@GetUser() user: { id: string }, @Query('accountId') accountId?: string) {
    return this.contentPublishService.listPublished(user.id, accountId);
  }

  @Delete(':id')
  async cancelPost(@GetUser() user: { id: string }, @Param('id') postId: string) {
    return this.contentPublishService.cancelPost(user.id, postId);
  }
}
