import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About - DMPilot',
  description:
    'DMPilot is an Instagram DM and comment automation platform for creators, brands and agencies, built on the official Meta Graph API.',
  alternates: { canonical: '/about' },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
