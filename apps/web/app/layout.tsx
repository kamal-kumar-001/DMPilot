import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import { AmbientBackground } from '@/components/landing/AmbientBackground';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#00BB88',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://www.dmpilot.org'),
  title: 'DMPilot — Instagram Business OS',
  description:
    'Meta-Compliant Instagram DM Automation & Social Commerce Business Operating System.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'DMPilot',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
  openGraph: {
    title: 'DMPilot - DM Automation',
    description: 'Scale your creator presence with high-performance Instagram DM automation.',
    url: 'https://www.dmpilot.org',
    siteName: 'DMPilot',
    images: [
      {
        url: 'https://www.dmpilot.org/icon.svg',
        width: 1200,
        height: 630,
        alt: 'DMPilot Logo',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  verification: {
    google: 'HFp8bpyG41psm7hb5aYEgShOZ50wfwEnVCsbBKZEfp8',
  },
  alternates: {
    canonical: '/',
    types: {
      'text/markdown': '/llms.txt',
    },
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DMPilot - Instagram DM Automation',
    description: 'Scale your creator presence with high-performance Instagram DM automation.',
    images: ['https://www.dmpilot.org/icon.svg'],
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'DMPilot',
  url: 'https://www.dmpilot.org',
  logo: 'https://www.dmpilot.org/icon.svg',
  description: 'Instagram DM automation and social commerce platform for creators.',
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'DMPilot',
  url: 'https://www.dmpilot.org',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans bg-background text-foreground antialiased min-h-screen relative">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <AmbientBackground />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
