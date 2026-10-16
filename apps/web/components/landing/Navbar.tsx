'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Zap, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { LANDING_NAV } from '@/lib/landing-data';

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 w-full ${
        scrolled || mobileOpen
          ? 'bg-[#FAF9F5]/90 backdrop-blur-xl border-b border-slate-200/80 shadow-sm'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group text-decoration-none">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-accent-cyan flex items-center justify-center shadow-brand group-hover:shadow-brand-lg transition-all">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-extrabold text-slate-900 tracking-tight leading-none group-hover:opacity-90 transition-opacity">
            {LANDING_NAV.logo}
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8">
          {LANDING_NAV.links.map((link) => (
            <a
              key={link.label}
              href={
                link.href.startsWith('#') ? (isHomePage ? link.href : `/${link.href}`) : link.href
              }
              className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* CTA Action Buttons */}
        <div className="hidden md:flex items-center gap-4">
          {session ? (
            <Link
              href="/dashboard"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent-cyan text-white text-sm font-bold shadow-brand hover:shadow-brand-lg transition-all transform hover:-translate-y-0.5"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent-cyan text-white text-sm font-bold shadow-brand hover:shadow-brand-lg transition-all transform hover:-translate-y-0.5"
              >
                Get Started Free
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <div className="flex md:hidden items-center">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown Panel */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden bg-white border-b border-slate-200 shadow-xl px-6 py-6 space-y-4"
          >
            <nav className="flex flex-col space-y-3">
              {LANDING_NAV.links.map((link) => (
                <a
                  key={link.label}
                  href={
                    link.href.startsWith('#')
                      ? isHomePage
                        ? link.href
                        : `/${link.href}`
                      : link.href
                  }
                  onClick={() => setMobileOpen(false)}
                  className="text-base font-semibold text-slate-700 hover:text-slate-900 py-2 border-b border-slate-100"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="pt-2 flex flex-col gap-3">
              {session ? (
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="w-full text-center py-3 rounded-xl bg-gradient-to-r from-primary to-accent-cyan text-white font-bold text-sm shadow-brand"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="w-full text-center py-2.5 rounded-xl border border-slate-200 text-slate-800 font-bold text-sm hover:bg-slate-50"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileOpen(false)}
                    className="w-full text-center py-3 rounded-xl bg-gradient-to-r from-primary to-accent-cyan text-white font-bold text-sm shadow-brand"
                  >
                    Get Started Free
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
