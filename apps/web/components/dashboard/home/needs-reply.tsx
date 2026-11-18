'use client';

import * as React from 'react';
import Link from 'next/link';
import { Inbox } from 'lucide-react';

/**
 * Placeholder for the future "Needs a reply" list. Thread attribution is not
 * verified yet, so this stays an honest concept card with no numbers.
 */
export function NeedsReply() {
  return (
    <div className="border border-dashed border-slate-300 rounded-2xl p-5 space-y-2 bg-white/50">
      <div className="flex items-center gap-2">
        <Inbox className="h-4 w-4 text-slate-400" />
        <h3 className="text-sm font-bold text-slate-500">Needs a reply</h3>
      </div>
      <p className="text-xs text-slate-400 font-medium">
        Not tracked yet. We can&apos;t reliably tell which conversations are still waiting on you,
        so there&apos;s no list here for now.
      </p>
      <Link href="/inbox" className="inline-block text-xs font-bold text-primary hover:underline">
        Open Inbox
      </Link>
    </div>
  );
}
