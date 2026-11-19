'use client';

import * as React from 'react';
import { HealthPanel } from '@/components/monitoring/health-panel';
import { QueueHealth } from '@/components/monitoring/queue-health';
import { WebhookLogs } from '@/components/monitoring/webhook-logs';
import { FailedJobs } from '@/components/monitoring/failed-jobs';
import { SystemMetricsPanel } from '@/components/monitoring/system-metrics';
import { AdminLogs } from './admin-logs';
import { AdminDeploy } from './admin-deploy';

/** Closed sections do not mount their data-fetching children. */
function MonitoringSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white/80 shadow-sm">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 p-5 text-left text-sm font-bold text-slate-900"
      >
        {title}
        <span aria-hidden="true" className="text-slate-400">
          {open ? '−' : '+'}
        </span>
      </button>
      {open && (
        <div id={id} className="border-t border-slate-100 p-4 sm:p-5">
          {children}
        </div>
      )}
    </section>
  );
}

export function AdminMonitoring() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HealthPanel />
        <SystemMetricsPanel />
      </div>
      <QueueHealth />
      <AdminDeploy />
      <MonitoringSection title="Failed Jobs Queue">
        <FailedJobs />
      </MonitoringSection>
      <MonitoringSection title="Webhook Audit & Failure Logs">
        <WebhookLogs />
      </MonitoringSection>
      <MonitoringSection title="Audit log">
        <AdminLogs />
      </MonitoringSection>
    </div>
  );
}
