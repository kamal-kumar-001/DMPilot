'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input, Label, toast } from '@autodm/ui';
import { Zap, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');
  const loggedOutParam =
    searchParams.get('logged_out') === '1' || searchParams.get('signOut') === 'true';
  const callbackUrl =
    searchParams.get('callbackUrl') || searchParams.get('redirect') || '/dashboard';
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    // If the user explicitly performed a log out, do NOT auto-redirect
    if (loggedOutParam) {
      return;
    }
    if (status === 'authenticated') {
      router.push(callbackUrl);
    }
  }, [status, loggedOutParam, callbackUrl, router]);

  const [showPassword, setShowPassword] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  React.useEffect(() => {
    if (errorParam === 'CredentialsSignIn') {
      toast.error('Invalid email or password credentials');
    }
    if (loggedOutParam) {
      toast.success('Logged out successfully');
    }
  }, [errorParam, loggedOutParam]);

  const onSubmit = async (data: LoginData) => {
    setLoading(true);
    const result = await signIn('credentials', {
      email: data.email,
      password: data.password,
      redirect: false,
    });
    setLoading(false);

    if (result?.error) {
      toast.error('Authentication failed. Invalid email or password.');
    } else {
      toast.success('Successfully logged in!');
      router.push(callbackUrl);
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative px-4 bg-background">
      {/* Background Mesh/Glow Blobs */}
      <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] bg-glow-gradient pointer-events-none opacity-40 blur-xl" />
      <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-mesh-gradient pointer-events-none opacity-30 blur-xl" />

      <div className="w-full max-w-md glass-card border-gradient p-8 rounded-2xl relative z-10 space-y-6 shadow-glass">
        {/* Brand Header */}
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-gradient-to-tr from-primary to-accent-cyan shadow-[0_0_15px_rgba(0,187,136,0.3)]">
            <Zap className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white mt-2">
            Welcome back to DMPilot
          </h1>
          <p className="text-sm text-gray-400">Log in to manage your automated campaigns.</p>
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
            {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                Forgot?
              </Link>
            </div>
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

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Authenticating...' : 'Sign In'}
          </Button>
        </form>

        {/* Compliance Footer Note */}
        <div className="space-y-3 pt-2 border-t border-white/5 text-center text-xs text-gray-400">
          <p className="text-[11px] text-gray-400">
            By signing in, you agree to our{' '}
            <Link href="/terms" className="text-primary hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </p>

          <div>
            Don&apos;t have an account?{' '}
            <Link
              href={
                callbackUrl !== '/dashboard'
                  ? `/register?callbackUrl=${encodeURIComponent(callbackUrl)}`
                  : '/register'
              }
              className="text-primary hover:underline font-medium"
            >
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
