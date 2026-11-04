'use client';

import React from 'react';
import { ReplyDesk } from '@/components/dashboard/reply-desk';

export default function ReplyDeskPage() {
  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
            Reply Desk
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Review audience comments, write public replies or private DMs, and keep unanswered conversations first.
          </p>
        </div>

        <ReplyDesk />
      </div>
    </>
  );
}
