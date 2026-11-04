import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// The manifest entry returns a session-dependent redirect, never cached HTML.
// No client hydration + /api/auth/session + second router hop at startup.
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const target = session?.user && session.error !== 'RefreshAccessTokenError' ? '/dashboard' : '/login';
  return NextResponse.redirect(new URL(target, request.url), {
    status: 307,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
