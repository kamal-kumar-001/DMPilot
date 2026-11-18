import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms that govern use of DMPilot.',
  alternates: { canonical: '/terms' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
