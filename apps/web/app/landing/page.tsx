'use client';

import * as React from 'react';
import Navbar from '@/components/landing/Navbar';
import Hero from '@/components/landing/Hero';
import TrustedBy from '@/components/landing/TrustedBy';
import Features from '@/components/landing/Features';
import DashboardMockup from '@/components/landing/DashboardMockup';
import Testimonials from '@/components/landing/Testimonials';
import SetupGuide from '@/components/landing/SetupGuide';
import FAQ from '@/components/landing/FAQ';
import Footer from '@/components/landing/Footer';
import { Megaphone } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api-client';
import { PromoSettings } from '@/types';

export default function LandingPage() {
  const [promo, setPromo] = React.useState<PromoSettings>({
    enabled: false,
    text: '',
    discountPercent: 0,
  });

  React.useEffect(() => {
    fetch(`${API_BASE_URL}/pricing-promo`)
      .then((res) => res.json())
      .then((resJson) => {
        if (resJson && resJson.success && resJson.data && resJson.data.promo) {
          setPromo(resJson.data.promo);
        }
      })
      .catch((err) => console.error('Failed to load promotions config on landing page', err));
  }, []);

  return (
    <div className="bg-[#FAF9F5] min-h-screen text-slate-900 antialiased selection:bg-emerald-100 selection:text-emerald-900 overflow-x-hidden">
      {/* Global Promotion Banner */}
      {promo.enabled && promo.text && (
        <div className="bg-gradient-to-r from-primary to-accent-cyan text-white text-center py-2 px-4 text-xs font-bold flex items-center justify-center space-x-2 relative z-50 tracking-wide shadow-sm">
          <Megaphone className="w-3.5 h-3.5 text-white flex-shrink-0 animate-bounce" />
          <span>{promo.text}</span>
        </div>
      )}

      {/* Subtle Warm Gradient Wash at Top */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-5%] left-[20%] w-[60vw] h-[400px] rounded-full bg-gradient-to-b from-emerald-100/40 via-teal-50/20 to-transparent blur-[100px]" />
      </div>

      {/* Render Subcomponents */}
      <div className="relative z-10">
        <Navbar />
        <Hero />
        {/* Social proof section temporarily commented out */}
        {/* <TrustedBy /> */}
        <Features />
        <DashboardMockup />
        {/* <Testimonials /> */}
        <SetupGuide />
        <FAQ />
        <Footer />
      </div>

      {/* Structured JSON-LD Data for LLMs and Search Crawlers */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'DMPilot',
            alternateName: 'AutoDM',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Cloud, Web, Instagram',
            description:
              'Meta-approved Instagram DM and comment automation engine for creators, brands, and agencies.',
            url: 'https://www.dmpilot.org',
            offers: {
              '@type': 'AggregateOffer',
              priceCurrency: 'INR',
              lowPrice: '0',
              highPrice: '999',
              offerCount: '3',
            },
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: '4.9',
              reviewCount: '142',
            },
          }),
        }}
      />
    </div>
  );
}
