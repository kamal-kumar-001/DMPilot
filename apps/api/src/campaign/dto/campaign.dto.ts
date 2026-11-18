import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CampaignStatus, CampaignType, MatchingRule } from '@prisma/client';

export class CampaignKeywordDto {
  @IsString()
  @IsNotEmpty()
  keyword!: string;

  @IsEnum(MatchingRule)
  matchingRule!: MatchingRule;
}

export class CampaignPostDto {
  @IsString()
  @IsNotEmpty()
  mediaId!: string;

  @IsString()
  @IsOptional()
  mediaUrl?: string;

  @IsString()
  @IsOptional()
  permalink?: string;
}

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty({ message: 'Campaign name is required' })
  name!: string;

  /** Idempotency key: retrying a create with the same key returns the original campaign. */
  @IsString()
  @IsOptional()
  clientRequestId?: string;

  /** Draft-first creation: pass PAUSED to stage a campaign without activating it. */
  @IsEnum(CampaignStatus, { message: 'Invalid campaign status' })
  @IsOptional()
  status?: CampaignStatus;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(CampaignType, { message: 'Invalid campaign type' })
  type!: CampaignType;

  @IsUUID('4', { message: 'Invalid Instagram Account ID' })
  @IsNotEmpty({ message: 'Instagram Account ID is required' })
  instagramAccountId!: string;

  @IsString()
  @IsNotEmpty({ message: 'Reply message text is required' })
  replyMessage!: string;

  @IsString()
  @IsOptional()
  replyMediaUrl?: string;

  @IsBoolean()
  @IsOptional()
  commentReplyEnabled?: boolean;

  @IsString()
  @IsOptional()
  commentReplyText?: string;

  @IsBoolean()
  @IsOptional()
  followCheckEnabled?: boolean;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CampaignKeywordDto)
  keywords?: CampaignKeywordDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CampaignPostDto)
  posts?: CampaignPostDto[];
}

export class UpdateCampaignDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(CampaignType)
  @IsOptional()
  type?: CampaignType;

  @IsUUID('4')
  @IsOptional()
  instagramAccountId?: string;

  @IsString()
  @IsOptional()
  replyMessage?: string;

  @IsString()
  @IsOptional()
  replyMediaUrl?: string;

  @IsBoolean()
  @IsOptional()
  commentReplyEnabled?: boolean;

  @IsString()
  @IsOptional()
  commentReplyText?: string;

  @IsBoolean()
  @IsOptional()
  followCheckEnabled?: boolean;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CampaignKeywordDto)
  keywords?: CampaignKeywordDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CampaignPostDto)
  posts?: CampaignPostDto[];
}
