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
import { AmbientBackground } from '@/components/landing/AmbientBackground';

export default function LandingPage() {
  return (
    <div className="bg-[#FAF9F5] min-h-screen text-slate-900 antialiased selection:bg-emerald-100 selection:text-emerald-900 overflow-x-hidden relative">
      {/* Full-Page Ambient Background Grid & Gradient */}
      <AmbientBackground />

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
