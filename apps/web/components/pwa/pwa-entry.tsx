'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { isStandaloneLaunch, pwaLaunchTarget } from '@/lib/pwa-launch';

export function PWAEntry({ children }: { children?: React.ReactNode }) {
  const router = useRouter();
  const { status, data: session } = useSession();
  // Optimistic web default: browsers render children immediately (no loading
  // screen / sudden page swap). A standalone PWA launch is detected
  // synchronously in the layout effect below and switches to the launch view
  // before paint, so installed-app users never see the landing page either.
  const [standalone, setStandalone] = React.useState<boolean>(false);
  React.useLayoutEffect(() => {
    setStandalone(
      isStandaloneLaunch(
        window.matchMedia('(display-mode: standalone)').matches,
        (navigator as Navigator & { standalone?: boolean }).standalone,
        document.referrer,
      ),
    );
  }, []);
  const isLaunch = standalone === true;
  React.useEffect(() => {
    if (!isLaunch) return;
    const target = pwaLaunchTarget(status, session?.error);
    if (target) router.replace(target);
  }, [isLaunch, status, session?.error, router]);

  if (!isLaunch) return <>{children}</>;
  // Standalone launch only: wait for the real session result. Never flash the
  // landing page or guess login from a still-loading session. Existing
  // standalone deep links remain untouched.
  return (
    <main className="relative z-10 min-h-screen grid place-items-center">
      <p role="status" className="text-sm text-slate-600">
        Opening DMPilot...
      </p>
    </main>
  );
}
