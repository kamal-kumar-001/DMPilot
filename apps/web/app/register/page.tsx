'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button, Input, Label, toast } from '@autodm/ui';
import { apiRequest } from '@/lib/api-client';
import { Zap, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    acceptTerms: z.boolean().refine((val) => val === true, {
      message: 'You must accept the Terms of Service & Privacy Policy to proceed',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const loggedOutParam =
    searchParams.get('logged_out') === '1' || searchParams.get('signOut') === 'true';
  const callbackUrl =
    searchParams.get('callbackUrl') || searchParams.get('redirect') || '/dashboard';
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  React.useEffect(() => {
    if (loggedOutParam) return;
    if (status === 'authenticated') {
      router.push(callbackUrl);
    }
  }, [status, loggedOutParam, callbackUrl, router]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '', acceptTerms: false },
  });

  const isAccepted = watch('acceptTerms');

  const onSubmit = async (data: RegisterData) => {
    setLoading(true);
    try {
      await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
        }),
      });
      toast.success('Account created successfully!', {
        description: 'Please check your inbox to verify your email address before logging in.',
      });
      router.push(
        callbackUrl !== '/dashboard'
          ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
          : '/login',
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Registration failed';
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative px-4 bg-background py-12 overflow-hidden">
      {/* Background Ambient Grid & Glow */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-primary/15 via-accent-cyan/10 to-transparent blur-[140px] pointer-events-none rounded-full" />

      <div className="w-full max-w-md glass-card border-gradient p-8 rounded-2xl relative z-10 space-y-6 shadow-glass">
        {/* Brand Header */}
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-gradient-to-tr from-primary to-accent-cyan shadow-[0_0_15px_rgba(0,187,136,0.3)]">
            <Zap className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white mt-2">
            Create your DMPilot account
          </h1>
          <p className="text-sm text-gray-400">Start scaling your creator automation today.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              placeholder="Alex Morgan"
              {...register('name')}
              className={errors.name ? 'border-red-500/50 focus-visible:ring-red-500' : ''}
            />
            {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@domain.com"
              {...register('email')}
              className={errors.email ? 'border-red-500/50 focus-visible:ring-red-500' : ''}
            />
            {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
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
                className={`pr-10 ${errors.confirmPassword ? 'border-red-500/50 focus-visible:ring-red-500' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                title={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-red-400 mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>

          {/* Mandatory DPDP Act 2023 & Meta Developer Policy Consent Checkbox */}
          <div className="space-y-1.5 pt-2 border-t border-white/5">
            <div className="flex items-start gap-2.5">
              <input
                id="acceptTerms"
                type="checkbox"
                {...register('acceptTerms')}
                className="mt-1 h-4 w-4 rounded border-white/10 bg-white/5 text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer"
              />
              <label
                htmlFor="acceptTerms"
                className="text-xs text-gray-300 leading-relaxed cursor-pointer select-none"
              >
                I agree to the{' '}
                <Link
                  href="/terms"
                  target="_blank"
                  className="text-primary hover:underline font-bold"
                >
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link
                  href="/privacy"
                  target="_blank"
                  className="text-primary hover:underline font-bold"
                >
                  Privacy Policy
                </Link>
                , and consent to processing my account data in compliance with India DPDP Act 2023 &
                Meta Developer Policy.
              </label>
            </div>
            {errors.acceptTerms && (
              <p className="text-xs text-red-400 mt-1">{errors.acceptTerms.message}</p>
            )}
          </div>

          <Button type="submit" disabled={loading || !isAccepted} className="w-full">
            {loading ? 'Creating account...' : 'Sign Up'}
          </Button>
        </form>

        {/* Security Compliance Badge */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400 font-medium pt-1">
          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>256-Bit SSL Encrypted • DPDP Act 2023 Compliant</span>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pt-2 border-t border-white/5">
          Already have an account?{' '}
          <Link
            href={
              callbackUrl !== '/dashboard'
                ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
                : '/login'
            }
            className="text-primary hover:underline font-medium"
          >
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
