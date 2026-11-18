import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export enum PublishMediaTypeDto {
  IMAGE = 'IMAGE',
  REEL = 'REEL',
  VIDEO = 'VIDEO',
  CAROUSEL = 'CAROUSEL',
}

export class CreatePublishDto {
  @IsString()
  @IsNotEmpty({ message: 'instagramAccountId is required' })
  instagramAccountId!: string;

  @IsString()
  @IsNotEmpty({ message: 'mediaUrl is required' })
  @IsUrl({}, { message: 'mediaUrl must be a valid HTTPS URL' })
  mediaUrl!: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsEnum(PublishMediaTypeDto)
  mediaType?: PublishMediaTypeDto;

  @IsOptional()
  @IsString()
  scheduledAt?: string;
}

export enum AdObjectiveDto {
  OUTCOME_ENGAGEMENT = 'OUTCOME_ENGAGEMENT',
  OUTCOME_MESSAGES = 'OUTCOME_MESSAGES',
  OUTCOME_TRAFFIC = 'OUTCOME_TRAFFIC',
}

export class CreateAdCampaignDto {
  @IsString()
  @IsNotEmpty({ message: 'instagramAccountId is required' })
  instagramAccountId!: string;

  @IsString()
  @IsNotEmpty({ message: 'Campaign name is required' })
  name!: string;

  @IsOptional()
  @IsEnum(AdObjectiveDto)
  objective?: AdObjectiveDto;

  @IsOptional()
  @Min(10000, { message: 'Daily budget must be at least ₹100 (10,000 paise)' })
  dailyBudgetPaise?: number;

  @IsOptional()
  @IsString()
  mediaId?: string;
}
