import { IsIn, IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';

export class GeneratePresignedUrlDto {
  @IsString()
  @IsNotEmpty()
  filename!: string;

  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'])
  contentType!: string;

  @IsNumber()
  @Min(1)
  @Max(1024 * 1024 * 1024) // 1GB max limit
  fileSize!: number;
}
