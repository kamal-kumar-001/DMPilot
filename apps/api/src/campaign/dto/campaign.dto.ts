import {
  IsArray,
  ArrayMaxSize,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CampaignStatus, CampaignType, MatchingRule } from '@prisma/client';

export class CampaignKeywordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
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
  @MaxLength(200)
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
  @MaxLength(1000)
  description?: string;

  @IsEnum(CampaignType, { message: 'Invalid campaign type' })
  type!: CampaignType;

  @IsUUID('4', { message: 'Invalid Instagram Account ID' })
  @IsNotEmpty({ message: 'Instagram Account ID is required' })
  instagramAccountId!: string;

  @IsString()
  @IsNotEmpty({ message: 'Reply message text is required' })
  @MaxLength(2000)
  replyMessage!: string;

  @IsString()
  @IsOptional()
  @MaxLength(2048)
  replyMediaUrl?: string;

  @IsBoolean()
  @IsOptional()
  commentReplyEnabled?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  commentReplyText?: string;

  @IsBoolean()
  @IsOptional()
  followCheckEnabled?: boolean;

  @IsArray()
  @IsOptional()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CampaignKeywordDto)
  keywords?: CampaignKeywordDto[];

  @IsArray()
  @IsOptional()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CampaignPostDto)
  posts?: CampaignPostDto[];
}

export class UpdateCampaignDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsEnum(CampaignType)
  @IsOptional()
  type?: CampaignType;

  @IsUUID('4')
  @IsOptional()
  instagramAccountId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  replyMessage?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2048)
  replyMediaUrl?: string;

  @IsBoolean()
  @IsOptional()
  commentReplyEnabled?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  commentReplyText?: string;

  @IsBoolean()
  @IsOptional()
  followCheckEnabled?: boolean;

  @IsArray()
  @IsOptional()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CampaignKeywordDto)
  keywords?: CampaignKeywordDto[];

  @IsArray()
  @IsOptional()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CampaignPostDto)
  posts?: CampaignPostDto[];
}
