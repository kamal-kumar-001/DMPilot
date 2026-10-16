'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Label, toast } from '@autodm/ui';
import { apiRequest } from '@/lib/api-client';
import { KeyRound, MailCheck } from 'lucide-react';
import Link from 'next/link';

const forgotSchema = z.object({
  email: z.string().email('Invalid email address'),
});

type ForgotData = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const [loading, setLoading] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotData>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotData) => {
    setLoading(true);
    try {
      await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setSubmitted(true);
      toast.success('Password reset link dispatched!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative px-4 bg-transparent py-12">
      <div className="w-full max-w-md bg-white border border-slate-200/90 p-8 rounded-3xl relative z-10 space-y-6 shadow-xl">
        {!submitted ? (
          <>
            {/* Header */}
            <div className="flex flex-col items-center space-y-2 text-center">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-tr from-primary to-accent-cyan shadow-md">
                <KeyRound className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 mt-2">
                Forgot password?
              </h1>
              <p className="text-sm text-slate-600">
                Enter your email address to receive password reset instructions.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-slate-700">
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@domain.com"
                  {...register('email')}
                  className={errors.email ? 'border-red-500/50 focus-visible:ring-red-500' : ''}
                />
                {errors.email && (
                  <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
                )}
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Sending reset instructions...' : 'Send Reset Link'}
              </Button>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center space-y-4 text-center py-4">
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-emerald-50 text-primary border border-emerald-200 animate-pulse">
              <MailCheck className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Instructions Dispatched</h2>
            <p className="text-sm text-slate-600 max-w-sm">
              If an account is associated with this email address, we have dispatched a secure
              password reset link. Please check your inbox (and spam folder).
            </p>
            <Button variant="secondary" className="w-full mt-2" onClick={() => setSubmitted(false)}>
              Back to Request
            </Button>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-100">
          Remembered password?{' '}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
