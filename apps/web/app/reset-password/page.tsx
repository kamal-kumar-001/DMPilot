'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input, Label, toast } from '@autodm/ui';
import { apiRequest } from '@/lib/api-client';
import { ShieldCheck, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';

const resetSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetData = z.infer<typeof resetSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetData>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  React.useEffect(() => {
    if (!token) {
      toast.error('Invalid reset token. Request a new password link.');
      router.push('/forgot-password');
    }
  }, [token, router]);

  const onSubmit = async (data: ResetData) => {
    if (!token) return;
    setLoading(true);
    try {
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token,
          password: data.password,
        }),
      });
      toast.success('Password reset successfully!');
      router.push('/login');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Reset failed');
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
        {/* Header */}
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-gradient-to-tr from-primary to-accent-cyan shadow-[0_0_15px_rgba(0,187,136,0.3)]">
            <ShieldCheck className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white mt-2">Reset password</h1>
          <p className="text-sm text-gray-400">Please enter and confirm your new password below.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">New Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('password')}
                className={`pr-10 ${errors.password ? 'border-red-500/50 focus-visible:ring-red-500' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('confirmPassword')}
                className={`pr-10 ${
                  errors.confirmPassword ? 'border-red-500/50 focus-visible:ring-red-500' : ''
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors cursor-pointer"
                title={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-red-400 mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Saving password...' : 'Reset Password'}
          </Button>
        </form>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pt-2 border-t border-white/5">
          Go back to{' '}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
