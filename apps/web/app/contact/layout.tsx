import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact - DMPilot',
  description: 'Contact the DMPilot team about Instagram DM automation, plans and support.',
  alternates: { canonical: '/contact' },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
