import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  const cookiesToClear = [
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    'next-auth.csrf-token',
    '__Host-next-auth.csrf-token',
    'next-auth.callback-url',
    '__Secure-next-auth.callback-url',
  ];

  const response = NextResponse.json({ success: true, message: 'Logged out' });

  for (const cookieName of cookiesToClear) {
    try {
      cookieStore.delete(cookieName);
    } catch {
      // ignore
    }
    response.cookies.set(cookieName, '', {
      path: '/',
      expires: new Date(0),
      maxAge: 0,
    });
  }

  return response;
}

export async function GET() {
  return POST();
}
