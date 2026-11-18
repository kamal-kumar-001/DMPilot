'use client';
import { useCreatorQuery } from './use-creator-query';
import { toast } from '@dmpilot/ui';

export const ROUTE_FEATURES: Record<string, { key: string; label: string }> = {
  '/reply-desk': { key: 'REPLY_DESK', label: 'Reply Desk' },
  '/delivery-logs': { key: 'WEBHOOK_LOGS', label: 'Delivery Logs' },
  '/analytics': { key: 'ANALYTICS_ADVANCED', label: 'Analytics' },
  '/publish': { key: 'CONTENT_PUBLISH', label: 'Studio Publisher' },
  '/ads': { key: 'ADS_MANAGEMENT', label: 'Ads & Growth' },
};
export function useFeatureAccess() {
  // Shared identity-scoped query: one read across shell, cards and wizard, no poll.
  const query = useCreatorQuery<Array<{ key: string; enabled: boolean }>>('/billing/flags', 30_000);
  const allowed = (key: string) =>
    !query.isError &&
    !query.isPending &&
    query.data?.some((f) => f.key === key && f.enabled === true) === true;
  // Resolved denial only: true when the entitlement check has FINISHED and the
  // feature is not included. While the check is pending (or errored) this is
  // false, so lock icons never flash for members during the 1-2s check.
  // Display-only: never use this to bypass authorization - `allowed` stays
  // fail-closed and `check` still gates every action.
  const denied = (key: string) =>
    !query.isPending && !query.isError && query.data !== undefined && !allowed(key);
  const check = (key: string, label: string) => {
    if (allowed(key)) return true;
    toast.error(
      query.isPending
        ? 'Checking feature access...'
        : query.isError
          ? 'Could not verify feature access. Please retry.'
          : `${label} is not included in your current plan. Upgrade to unlock it.`,
    );
    return false;
  };
  return { ...query, allowed, denied, check };
}
