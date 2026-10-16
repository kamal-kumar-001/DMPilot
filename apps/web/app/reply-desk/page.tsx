'use client';

import React from 'react';
import { DashboardLayout } from '@/components/dashboard/layout';
import { ReplyDesk } from '@/components/dashboard/reply-desk';

export default function ReplyDeskPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
            Reply Desk
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Review important customer comments, price inquiries, and dispatch public comment replies
            or private DMs.
          </p>
        </div>

        <ReplyDesk />
      </div>
    </DashboardLayout>
  );
}
