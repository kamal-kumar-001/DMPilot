import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
  Matches,
  IsDateString,
} from 'class-validator';
import { CouponDiscountType } from '@prisma/client';

export class CreateCouponDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9_-]{3,30}$/, {
    message: 'Coupon code must be 3-30 alphanumeric characters, hyphens or underscores',
  })
  code!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(CouponDiscountType)
  discountType!: CouponDiscountType;

  @IsNumber()
  @Min(1)
  discountValue!: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  maxDiscountPaise?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  minOrderAmountPaise?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  maxRedemptions?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  maxRedemptionsPerUser?: number;

  @IsString()
  @IsOptional()
  applicablePlans?: string;

  @IsString()
  @IsOptional()
  applicableCycles?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsDateString()
  @IsOptional()
  startsAt?: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}

export class UpdateCouponDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(CouponDiscountType)
  @IsOptional()
  discountType?: CouponDiscountType;

  @IsNumber()
  @IsOptional()
  @Min(1)
  discountValue?: number;

  @IsNumber()
  @IsOptional()
  maxDiscountPaise?: number | null;

  @IsNumber()
  @IsOptional()
  minOrderAmountPaise?: number | null;

  @IsNumber()
  @IsOptional()
  maxRedemptions?: number | null;

  @IsNumber()
  @IsOptional()
  @Min(1)
  maxRedemptionsPerUser?: number;

  @IsString()
  @IsOptional()
  applicablePlans?: string;

  @IsString()
  @IsOptional()
  applicableCycles?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsDateString()
  @IsOptional()
  startsAt?: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string | null;
}
