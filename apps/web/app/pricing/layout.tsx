import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing - DMPilot Instagram DM Automation',
  description:
    'Free and paid DMPilot plans for Instagram comment-to-DM automation, keyword DM responders and multi-account agency workspaces. See current plans and limits.',
  alternates: { canonical: '/pricing' },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
