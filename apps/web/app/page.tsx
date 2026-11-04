'use client';

import * as React from 'react';
import LandingPage from './landing/page';
import { PWAEntry } from '@/components/pwa/pwa-entry';

export default function RootPage() {
  return <PWAEntry><LandingPage /></PWAEntry>;
}
