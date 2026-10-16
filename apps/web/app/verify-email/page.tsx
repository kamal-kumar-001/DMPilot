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
    <div className="min-h-screen flex items-center justify-center relative px-4 bg-transparent py-12">
      <div className="w-full max-w-md bg-white border border-slate-200/90 p-8 rounded-3xl relative z-10 space-y-6 shadow-xl text-center">
        {status === 'loading' && (
          <div className="flex flex-col items-center space-y-4 py-8">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <h2 className="text-xl font-bold text-slate-900">Verifying your email</h2>
            <p className="text-sm text-slate-600">
              Please wait while we confirm your registration details...
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center space-y-4 py-6">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <h2 className="text-xl font-bold text-slate-900">Verification Complete</h2>
            <p className="text-sm text-slate-600 max-w-sm">
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
            <h2 className="text-xl font-bold text-slate-900">Verification Failed</h2>
            <p className="text-sm text-red-500 max-w-sm">{errorMsg}</p>
            <Button variant="secondary" asChild className="w-full mt-4">
              <Link href="/register">Back to Register</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
