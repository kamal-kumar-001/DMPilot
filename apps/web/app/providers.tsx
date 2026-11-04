'use client';

import React from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@dmpilot/ui';
import { SessionProvider, useSession, signOut } from 'next-auth/react';

import { clearApiSession, registerMutationListener } from '@/lib/api-client';

import { PWAProvider } from '@/components/pwa/pwa-context';
import { PWAMobileBanner } from '@/components/pwa/pwa-install-button';

function QueryBoundary({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const client = useQueryClient();
  const identity = status === 'authenticated' ? session?.user?.id : undefined;
  const previous = React.useRef(identity);
  const previousToken = React.useRef(session?.accessToken);
  React.useEffect(() => {
    if (previousToken.current && previousToken.current !== session?.accessToken) {
      clearApiSession();
      void client.invalidateQueries({ queryKey: ['creator', identity] });
    }
    previousToken.current = session?.accessToken;
  }, [client, identity, session?.accessToken]);
  React.useEffect(() => {
    const clear = () => {
      clearApiSession();
    };
    const storage = (event: StorageEvent) => {
      if (event.key === 'nextauth.message') {
        clearApiSession();
        void client.cancelQueries({ queryKey: ['creator'] });
        // Keep observers attached while NextAuth resolves the new identity.
        // Identity change below removes only the previous account's data.
      }
    };
    const denied = () => { void client.invalidateQueries({queryKey: ['creator', identity, '/billing/flags']}); };
    window.addEventListener('feature-access-denied', denied);
    window.addEventListener('storage', storage);
    window.addEventListener('focus', clear);
    return () => {
      window.removeEventListener('feature-access-denied', denied);
      window.removeEventListener('storage', storage);
      window.removeEventListener('focus', clear);
    };
  }, [client, identity]);
  React.useEffect(() => {
    if (previous.current !== identity) {
      if (previous.current) {
        void client.cancelQueries({ queryKey: ['creator', previous.current] });
        client.removeQueries({ queryKey: ['creator', previous.current] });
      }
      if (previous.current) clearApiSession();
      previous.current = identity;
    }
  }, [client, identity]);
  React.useEffect(
    () =>
      registerMutationListener((path) => {
        if (/^\/(campaigns|instagram|billing)(\/|$)/.test(path)) {
          void client.invalidateQueries({ queryKey: ['creator', identity] });
        }
      }),
    [client, identity],
  );
  return <React.Fragment key={identity ?? 'signed-out'}>{children}</React.Fragment>;
}

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
          defaultTheme="light"
          forcedTheme="light"
          disableTransitionOnChange
        >
          <QueryClientProvider client={queryClient}>
            <QueryBoundary>
              <PWAProvider>
                {children}
                <PWAMobileBanner />
              </PWAProvider>
            </QueryBoundary>
            <Toaster />
          </QueryClientProvider>
        </ThemeProvider>
      </SessionWatcher>
    </SessionProvider>
  );
}
