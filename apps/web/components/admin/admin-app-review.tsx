'use client';

import * as React from 'react';
import { apiRequest } from '@/lib/api-client';
import { toast } from '@dmpilot/ui';
import { Shield, ShieldAlert, ShieldOff, Loader2 } from 'lucide-react';
import { ConfirmDialog } from './confirm-dialog';

interface AppReviewStatus {
  active: boolean;
  since: string | null;
  snapshotId: string | null;
}

/**
 * Guarded App Review Mode. Enabling sets every plan to unlimited quotas and
 * enables every feature flag, but only after saving a snapshot of the current
 * state and only with typed confirmation. Disabling restores the snapshot,
 * also with typed confirmation. Both directions are audit logged with
 * before-values.
 */
export function AdminAppReview() {
  const [status, setStatus] = React.useState<AppReviewStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [acting, setActing] = React.useState(false);
  const [dialog, setDialog] = React.useState<'enable' | 'disable' | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<AppReviewStatus>('/admin/app-review-mode');
      setStatus(data);
    } catch {
      toast.error('Failed to load App Review Mode status.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const run = async (action: 'enable' | 'disable', confirm: string) => {
    setActing(true);
    try {
      const res = await apiRequest<{ message: string }>(`/admin/${action}-app-review-mode`, {
        method: 'POST',
        body: JSON.stringify({ confirm }),
      });
      toast.success(res.message);
      setDialog(null);
      load();
    } catch (err: any) {
      toast.error(err?.message || `Failed to ${action} App Review Mode.`);
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white/85 backdrop-blur-xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex items-start space-x-4">
          <div
            className={`flex items-center justify-center h-11 w-11 rounded-xl border flex-shrink-0 ${
              status?.active ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'
            }`}
          >
            {status?.active ? (
              <ShieldAlert className="h-5 w-5 text-amber-600" />
            ) : (
              <Shield className="h-5 w-5 text-slate-500" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-base font-extrabold text-slate-900">
              App Review Mode {status?.active ? 'is ACTIVE' : 'is off'}
            </h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {loading
                ? 'Loading status...'
                : status?.active
                  ? `Enabled ${status.since ? new Date(status.since).toLocaleString() : ''}. All plans are unlimited and all feature flags are on. A snapshot of the previous configuration is saved and can be restored.`
                  : 'While active, every plan gets unlimited quotas and every feature flag is enabled, so Meta reviewers can exercise the full product. A snapshot of the current plans and flags is saved first and can be restored afterwards.'}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center space-x-3">
          {status?.active ? (
            <button
              type="button"
              onClick={() => setDialog('disable')}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5"
            >
              <ShieldOff className="h-3.5 w-3.5" />
              <span>Disable and restore previous state</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setDialog('enable')}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Enable App Review Mode</span>
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={dialog === 'enable'}
        title="Enable App Review Mode?"
        description="This sets every plan to unlimited quotas and enables every feature flag for all plans. The current configuration is snapshotted first so it can be restored. This action is audit logged with before-values."
        confirmText="ENABLE APP REVIEW"
        confirmButtonLabel="Enable"
        loading={acting}
        onConfirm={() => run('enable', 'ENABLE APP REVIEW')}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === 'disable'}
        title="Restore previous configuration?"
        description="Plan quotas and feature flags are restored from the saved snapshot. Changes made to plans or flags while App Review Mode was active are overwritten by the restore."
        confirmText="RESTORE"
        confirmButtonLabel="Restore"
        loading={acting}
        onConfirm={() => run('disable', 'RESTORE')}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}
