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
    <div className="min-h-screen flex items-center justify-center relative px-4 bg-background overflow-hidden">
      {/* Background Ambient Grid & Glow */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-primary/15 via-accent-cyan/10 to-transparent blur-[140px] pointer-events-none rounded-full" />

      <div className="w-full max-w-md glass-card border-gradient p-8 rounded-2xl relative z-10 space-y-6 shadow-glass">
        {!submitted ? (
          <>
            {/* Header */}
            <div className="flex flex-col items-center space-y-2 text-center">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-gradient-to-tr from-primary to-accent-cyan shadow-[0_0_15px_rgba(0,187,136,0.3)]">
                <KeyRound className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white mt-2">
                Forgot password?
              </h1>
              <p className="text-sm text-gray-400">
                Enter your email address to receive password reset instructions.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@domain.com"
                  {...register('email')}
                  className={errors.email ? 'border-red-500/50 focus-visible:ring-red-500' : ''}
                />
                {errors.email && (
                  <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>
                )}
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Sending reset instructions...' : 'Send Reset Link'}
              </Button>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center space-y-4 text-center py-4">
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 text-primary animate-pulse">
              <MailCheck className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-white">Instructions Dispatched</h2>
            <p className="text-sm text-gray-400 max-w-sm">
              If an account is associated with this email address, we have dispatched a secure
              password reset link. Please check your inbox (and spam folder).
            </p>
            <Button variant="secondary" className="w-full mt-2" onClick={() => setSubmitted(false)}>
              Back to Request
            </Button>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pt-2 border-t border-white/5">
          Remembered password?{' '}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
