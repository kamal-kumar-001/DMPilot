import { IsString, IsNotEmpty, IsEnum, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Plan, BillingCycle } from '@prisma/client';

export class ValidateCouponDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsEnum(Plan)
  plan!: Plan;

  @IsEnum(BillingCycle)
  cycle!: BillingCycle;
}

export interface CouponValidationResult {
  valid: boolean;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  discountPaise: number;
  discountFormatted: string;
  originalAmountPaise: number;
  discountedBaseAmountPaise: number;
  taxPaise: number;
  totalAmountPaise: number;
  message?: string;
}
