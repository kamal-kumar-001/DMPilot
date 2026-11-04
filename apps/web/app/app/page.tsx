'use client';
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
export default function AppLaunch() {
  const { status } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (status !== 'loading') router.replace(status === 'authenticated' ? '/dashboard' : '/login');
  }, [status, router]);
  return (
    <main className="relative z-10 min-h-screen grid place-items-center">
      <p role="status" className="text-sm text-slate-600">
        Opening DMPilot...
      </p>
    </main>
  );
}
