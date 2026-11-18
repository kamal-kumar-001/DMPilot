import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { API_KEY_SCOPES } from '../utils/api-key-scopes';

export class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty({ message: 'Key name is required' })
  @MinLength(1, { message: 'Name must have at least 1 character' })
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  name!: string;

  @IsOptional()
  @Min(1, { message: 'Expiration must be at least 1 day' })
  @Max(365, { message: 'Expiration cannot exceed 365 days' })
  expiresInDays?: number;

  /** Least privilege: omit for a read-only key. Unknown scopes are rejected. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsIn(API_KEY_SCOPES as readonly string[], { each: true })
  scopes?: string[];

  /** Restrict the key to these connected Instagram accounts (empty = any of the user's accounts). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  instagramAccountIds?: string[];
}

export class ApiKeyResponseDto {
  id!: string;
  name!: string;
  prefix!: string;
  scopes!: string[];
  instagramAccountIds!: string[];
  lastUsedAt?: Date | null;
  expiresAt?: Date | null;
  createdAt!: Date;
}

export class CreateApiKeyResponseDto extends ApiKeyResponseDto {
  apiKey!: string; // Only returned once at creation!
}
