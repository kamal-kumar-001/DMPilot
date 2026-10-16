'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, toast } from '@autodm/ui';
import { apiRequest } from '@/lib/api-client';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = React.useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = React.useState('');
  const hasVerified = React.useRef(false);

  React.useEffect(() => {
    if (hasVerified.current) return;
    hasVerified.current = true;

    if (!token) {
      setStatus('error');
      setErrorMsg('Verification link is invalid or has expired.');
      return;
    }

    const verifyToken = async () => {
      try {
        await apiRequest('/auth/verify-email', {
          method: 'POST',
          body: JSON.stringify({ token }),
        });
        setStatus('success');
        toast.success('Email verified successfully!');
      } catch (error) {
        setStatus('error');
        setErrorMsg(error instanceof Error ? error.message : 'Failed to verify email.');
      }
    };

    verifyToken();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center relative px-4 bg-background overflow-hidden">
      {/* Background Ambient Grid & Glow */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-primary/15 via-accent-cyan/10 to-transparent blur-[140px] pointer-events-none rounded-full" />

      <div className="w-full max-w-md glass-card border-gradient p-8 rounded-2xl relative z-10 space-y-6 shadow-glass text-center">
        {status === 'loading' && (
          <div className="flex flex-col items-center space-y-4 py-8">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <h2 className="text-xl font-bold text-white">Verifying your email</h2>
            <p className="text-sm text-gray-400">
              Please wait while we confirm your registration details...
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center space-y-4 py-6">
            <CheckCircle2 className="h-12 w-12 text-primary text-glow" />
            <h2 className="text-xl font-bold text-white">Verification Complete</h2>
            <p className="text-sm text-gray-400 max-w-sm">
              Your email has been verified. You can now log in to access your creator workspace.
            </p>
            <Button asChild className="w-full mt-4">
              <Link href="/login">Go to Login</Link>
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center space-y-4 py-6">
            <XCircle className="h-12 w-12 text-red-500" />
            <h2 className="text-xl font-bold text-white">Verification Failed</h2>
            <p className="text-sm text-red-400 max-w-sm">{errorMsg}</p>
            <Button variant="secondary" asChild className="w-full mt-4">
              <Link href="/register">Back to Register</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
