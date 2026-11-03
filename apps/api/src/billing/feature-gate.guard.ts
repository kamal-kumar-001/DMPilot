import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagService } from './feature-flag.service';
import { SubscriptionService } from './subscription.service';

export const REQUIRED_FEATURE_KEY = 'required_feature';

/** Decorator — usage: @RequiresFeature('ANALYTICS_ADVANCED') */
export function RequiresFeature(featureKey: string) {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(REQUIRED_FEATURE_KEY, featureKey, descriptor.value);
    return descriptor;
  };
}

/**
 * Guard that enforces admin-controlled feature flags per plan.
 * Decorate a route with @RequiresFeature('FLAG_KEY') to gate it.
 * Admins always pass so staff tooling never locks itself out.
 * Flags seeded as enabled for every plan (Meta App Review mode) change nothing
 * until an admin restricts a flag's plans in Admin Panel → Feature Flags.
 */
@Injectable()
export class FeatureGateGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlagService: FeatureFlagService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const featureKey = this.reflector.get<string>(REQUIRED_FEATURE_KEY, context.getHandler());
    if (!featureKey) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;
    if (user.role === 'ADMIN') return true;

    const sub = await this.subscriptionService.getOrCreate(user.id);
    const enabled = await this.featureFlagService.isEnabled(featureKey, sub.plan);
    if (!enabled) {
      throw new ForbiddenException(
        `${featureKey} is not included in your current plan (${sub.plan}). Upgrade your plan to unlock it.`,
      );
    }
    return true;
  }
}
