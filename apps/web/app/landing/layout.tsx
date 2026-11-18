import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DMPilot - Instagram DM Automation & Comment-to-DM for Creators',
  description:
    'Turn Instagram comments into DM conversations automatically. Comment-to-DM keyword triggers, public auto replies, story reply and welcome DM automation, and a multilingual engine built on the official Meta Graph API. Free plan available.',
  alternates: { canonical: '/' },
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
