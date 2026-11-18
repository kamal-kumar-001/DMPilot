import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'DMPilot plans and pricing for Instagram DM automation.',
  alternates: { canonical: '/pricing' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
