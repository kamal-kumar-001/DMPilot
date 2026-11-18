import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How DMPilot collects, uses and protects your data.',
  alternates: { canonical: '/privacy' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
