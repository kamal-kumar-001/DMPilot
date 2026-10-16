'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@autodm/ui';
import { SessionProvider, useSession, signOut } from 'next-auth/react';

import { PWAProvider } from '@/components/pwa/pwa-context';
import { PWAMobileBanner } from '@/components/pwa/pwa-install-button';

function SessionWatcher({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  React.useEffect(() => {
    if (session?.error === 'RefreshAccessTokenError') {
      signOut({ callbackUrl: '/login?logged_out=1' });
    }
  }, [session]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <SessionProvider>
      <SessionWatcher>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          disableTransitionOnChange
        >
          <QueryClientProvider client={queryClient}>
            <PWAProvider>
              {children}
              <PWAMobileBanner />
            </PWAProvider>
            <Toaster />
          </QueryClientProvider>
        </ThemeProvider>
      </SessionWatcher>
    </SessionProvider>
  );
}
