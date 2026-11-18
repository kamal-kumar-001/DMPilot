import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About',
  description: 'About DMPilot: Instagram DM automation built on Meta-compliant delivery.',
  alternates: { canonical: '/about' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
