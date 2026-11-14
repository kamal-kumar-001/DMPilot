import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Plan, BillingCycle, CouponDiscountType, Prisma } from '@prisma/client';
import { CouponValidationResult } from './dto/coupon.dto';
import { CreateCouponDto, UpdateCouponDto } from '../admin/dto/admin-coupon.dto';

@Injectable()
export class CouponService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate a coupon code for a given user, plan, and cycle.
   * Calculates the exact paise discount, net taxable base, and 18% GST.
   */
  async validateCoupon(
    userId: string,
    rawCode: string,
    plan: Plan,
    cycle: BillingCycle,
  ): Promise<CouponValidationResult & { couponId: string }> {
    if (!rawCode || typeof rawCode !== 'string') {
      throw new BadRequestException('A coupon code is required.');
    }

    const code = rawCode.trim().toUpperCase();
    const coupon = await this.prisma.coupon.findUnique({
      where: { code },
    });

    if (!coupon || !coupon.isActive) {
      throw new BadRequestException('Invalid or inactive coupon code.');
    }

    const now = new Date();
    if (coupon.startsAt && now < coupon.startsAt) {
      throw new BadRequestException('Coupon code is not active yet.');
    }

    if (coupon.expiresAt && now > coupon.expiresAt) {
      throw new BadRequestException('Coupon code has expired.');
    }

    // Check plan restriction
    if (coupon.applicablePlans) {
      const allowedPlans = coupon.applicablePlans
        .split(',')
        .map((p) => p.trim().toUpperCase())
        .filter(Boolean);
      if (allowedPlans.length > 0 && !allowedPlans.includes(String(plan).toUpperCase())) {
        throw new BadRequestException(`This coupon is not valid for the ${plan} plan.`);
      }
    }

    // Check cycle restriction
    if (coupon.applicableCycles) {
      const allowedCycles = coupon.applicableCycles
        .split(',')
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);
      if (allowedCycles.length > 0 && !allowedCycles.includes(String(cycle).toUpperCase())) {
        throw new BadRequestException(
          `This coupon is not valid for ${cycle.toLowerCase()} billing.`,
        );
      }
    }

    // Check global redemption limit
    if (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions) {
      throw new BadRequestException('This coupon has reached its maximum redemption limit.');
    }

    // Check per-user redemption limit
    if (userId) {
      const userRedemptionCount = await this.prisma.couponRedemption.count({
        where: { couponId: coupon.id, userId },
      });
      if (
        coupon.maxRedemptionsPerUser !== null &&
        userRedemptionCount >= coupon.maxRedemptionsPerUser
      ) {
        throw new BadRequestException('You have already used this coupon code.');
      }
    }

    // Get plan pricing in paise
    const planConfig = await this.prisma.billingPlan.findUnique({
      where: { key: plan },
    });
    if (!planConfig) {
      throw new BadRequestException('Plan configuration not found.');
    }

    const basePriceRupees =
      cycle === BillingCycle.YEARLY ? planConfig.priceYearly : planConfig.priceMonthly;
    if (
      typeof basePriceRupees !== 'number' ||
      !Number.isFinite(basePriceRupees) ||
      basePriceRupees <= 0
    ) {
      throw new BadRequestException('Plan has no valid configured price.');
    }

    const originalBaseAmountPaise = Math.round(basePriceRupees * 100);

    // Check minimum order amount
    if (
      coupon.minOrderAmountPaise !== null &&
      originalBaseAmountPaise < coupon.minOrderAmountPaise
    ) {
      const minRupees = (coupon.minOrderAmountPaise / 100).toFixed(2);
      throw new BadRequestException(
        `Order does not meet minimum amount requirement of ₹${minRupees}.`,
      );
    }

    // Calculate discount in paise
    let discountPaise = 0;
    if (coupon.discountType === CouponDiscountType.PERCENTAGE) {
      const pct = Math.max(0, Math.min(100, coupon.discountValue));
      let calculated = Math.round((originalBaseAmountPaise * pct) / 100);
      if (coupon.maxDiscountPaise !== null && coupon.maxDiscountPaise > 0) {
        calculated = Math.min(calculated, coupon.maxDiscountPaise);
      }
      discountPaise = Math.min(calculated, originalBaseAmountPaise);
    } else {
      // FIXED_AMOUNT (already in paise)
      discountPaise = Math.min(coupon.discountValue, originalBaseAmountPaise);
    }

    const discountedBaseAmountPaise = Math.max(0, originalBaseAmountPaise - discountPaise);
    const taxPaise = Math.round(discountedBaseAmountPaise * 0.18);
    const totalAmountPaise = discountedBaseAmountPaise + taxPaise;

    const discountFormatted =
      coupon.discountType === CouponDiscountType.PERCENTAGE
        ? `${coupon.discountValue}% OFF`
        : `₹${(discountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })} OFF`;

    return {
      valid: true,
      couponId: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountPaise,
      discountFormatted,
      originalAmountPaise: originalBaseAmountPaise,
      discountedBaseAmountPaise,
      taxPaise,
      totalAmountPaise,
      message: 'Coupon applied successfully',
    };
  }

  /**
   * Redeem a coupon within an existing Prisma transaction or client.
   * Increments the redemption count and creates a CouponRedemption audit record.
   */
  async recordRedemption(
    tx: Prisma.TransactionClient | PrismaService,
    params: {
      couponId: string;
      userId: string;
      discountPaise: number;
      orderAmountPaise: number;
      sessionId?: string;
      invoiceId?: string;
    },
  ) {
    const { couponId, userId, discountPaise, orderAmountPaise, sessionId, invoiceId } = params;

    // Increment coupon redemption count
    await tx.coupon.update({
      where: { id: couponId },
      data: { redemptionCount: { increment: 1 } },
    });

    // Create redemption record
    return tx.couponRedemption.create({
      data: {
        couponId,
        userId,
        discountPaise,
        orderAmountPaise,
        sessionId: sessionId || null,
        invoiceId: invoiceId || null,
      },
    });
  }

  // ─── Admin Coupon Management ──────────────────────────────────────

  async listCoupons() {
    const coupons = await this.prisma.coupon.findMany({
      include: {
        _count: {
          select: { redemptions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return coupons.map((c) => ({
      ...c,
      totalRedemptions: c._count.redemptions,
    }));
  }

  async getCoupon(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: {
        redemptions: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    return coupon;
  }

  async createCoupon(dto: CreateCouponDto) {
    const code = dto.code.trim().toUpperCase();

    const existing = await this.prisma.coupon.findUnique({
      where: { code },
    });
    if (existing) {
      throw new BadRequestException(`Coupon code "${code}" already exists.`);
    }

    if (dto.discountType === CouponDiscountType.PERCENTAGE) {
      if (dto.discountValue < 1 || dto.discountValue > 100) {
        throw new BadRequestException('Percentage discount must be between 1 and 100.');
      }
    } else {
      if (dto.discountValue <= 0) {
        throw new BadRequestException('Fixed discount amount must be greater than zero.');
      }
    }

    if (dto.startsAt && dto.expiresAt) {
      if (new Date(dto.startsAt) >= new Date(dto.expiresAt)) {
        throw new BadRequestException('Expiration date must be after start date.');
      }
    }

    return this.prisma.coupon.create({
      data: {
        code,
        description: dto.description || null,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maxDiscountPaise: dto.maxDiscountPaise || null,
        minOrderAmountPaise: dto.minOrderAmountPaise || null,
        maxRedemptions: dto.maxRedemptions || null,
        maxRedemptionsPerUser: dto.maxRedemptionsPerUser ?? 1,
        applicablePlans: dto.applicablePlans || 'PRO,ENTERPRISE',
        applicableCycles: dto.applicableCycles || 'MONTHLY,YEARLY',
        isActive: dto.isActive ?? true,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : new Date(),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
  }

  async updateCoupon(id: string, dto: UpdateCouponDto) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    const discountType = dto.discountType || coupon.discountType;
    const discountValue = dto.discountValue ?? coupon.discountValue;

    if (discountType === CouponDiscountType.PERCENTAGE) {
      if (discountValue < 1 || discountValue > 100) {
        throw new BadRequestException('Percentage discount must be between 1 and 100.');
      }
    } else {
      if (discountValue <= 0) {
        throw new BadRequestException('Fixed discount amount must be greater than zero.');
      }
    }

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : coupon.startsAt;
    const expiresAt =
      dto.expiresAt !== undefined
        ? dto.expiresAt
          ? new Date(dto.expiresAt)
          : null
        : coupon.expiresAt;

    if (startsAt && expiresAt && startsAt >= expiresAt) {
      throw new BadRequestException('Expiration date must be after start date.');
    }

    return this.prisma.coupon.update({
      where: { id },
      data: {
        description: dto.description !== undefined ? dto.description : undefined,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maxDiscountPaise: dto.maxDiscountPaise !== undefined ? dto.maxDiscountPaise : undefined,
        minOrderAmountPaise:
          dto.minOrderAmountPaise !== undefined ? dto.minOrderAmountPaise : undefined,
        maxRedemptions: dto.maxRedemptions !== undefined ? dto.maxRedemptions : undefined,
        maxRedemptionsPerUser: dto.maxRedemptionsPerUser,
        applicablePlans: dto.applicablePlans,
        applicableCycles: dto.applicableCycles,
        isActive: dto.isActive !== undefined ? dto.isActive : undefined,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        expiresAt:
          dto.expiresAt !== undefined
            ? dto.expiresAt
              ? new Date(dto.expiresAt)
              : null
            : undefined,
      },
    });
  }

  async deleteCoupon(id: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    return this.prisma.coupon.delete({
      where: { id },
    });
  }

  async getCouponRedemptions(couponId: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id: couponId } });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    return this.prisma.couponRedemption.findMany({
      where: { couponId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
