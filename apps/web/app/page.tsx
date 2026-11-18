import type { Metadata } from 'next';
import LandingClient from '@/components/landing/landing-client';

export const metadata: Metadata = {
  title: 'DMPilot - Instagram DM Automation & Comment-to-DM for Creators',
  description:
    'Turn Instagram comments into DM conversations automatically. Comment-to-DM keyword triggers, public auto replies, story reply and welcome DM automation, and a multilingual engine built on the official Meta Graph API. Free plan available.',
  keywords: [
    'instagram dm automation',
    'comment to dm automation',
    'instagram auto reply',
    'instagram comment to dm tool',
    'manychat alternative',
    'instagram dm automation for creators',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'DMPilot - Instagram DM Automation & Comment-to-DM for Creators',
    description:
      'Turn Instagram comments into DM conversations automatically, built on the official Meta Graph API. Free plan available.',
    url: 'https://www.dmpilot.org',
    siteName: 'DMPilot',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'DMPilot - Instagram DM Automation & Comment-to-DM for Creators',
    description:
      'Turn Instagram comments into DM conversations automatically, built on the official Meta Graph API. Free plan available.',
  },
};

export default function RootPage() {
  return <LandingClient />;
}
