'use client';

import * as React from 'react';
import LandingPage from '@/app/landing/page';
import { PWAEntry } from '@/components/pwa/pwa-entry';

export default function LandingClient() {
  return (
    <PWAEntry>
      <LandingPage />
    </PWAEntry>
  );
}
