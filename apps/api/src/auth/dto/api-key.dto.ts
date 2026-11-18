import { IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

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
}

export class ApiKeyResponseDto {
  id!: string;
  name!: string;
  prefix!: string;
  lastUsedAt?: Date | null;
  expiresAt?: Date | null;
  createdAt!: Date;
}

export class CreateApiKeyResponseDto extends ApiKeyResponseDto {
  apiKey!: string; // Only returned once at creation!
}
