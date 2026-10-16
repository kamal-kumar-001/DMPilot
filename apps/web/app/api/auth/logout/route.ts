import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = cookies();
  const allCookies = cookieStore.getAll();
  const response = NextResponse.json({ success: true, message: 'Logged out' });

  // Delete all existing cookies matching next-auth, session, csrf, token
  for (const cookie of allCookies) {
    if (
      cookie.name.includes('next-auth') ||
      cookie.name.includes('session') ||
      cookie.name.includes('csrf') ||
      cookie.name.includes('callback')
    ) {
      response.cookies.set(cookie.name, '', {
        path: '/',
        expires: new Date(0),
        maxAge: 0,
      });
      try {
        cookieStore.delete(cookie.name);
      } catch {
        // ignore
      }
    }
  }

  // Also aggressively delete known names & chunks
  const standardNames = [
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    'next-auth.csrf-token',
    '__Host-next-auth.csrf-token',
    'next-auth.callback-url',
    '__Secure-next-auth.callback-url',
    'next-auth.pkce.code_verifier',
  ];

  for (const name of standardNames) {
    response.cookies.set(name, '', {
      path: '/',
      expires: new Date(0),
      maxAge: 0,
    });
    for (let i = 0; i <= 5; i++) {
      response.cookies.set(`${name}.${i}`, '', {
        path: '/',
        expires: new Date(0),
        maxAge: 0,
      });
    }
  }

  return response;
}

export async function GET() {
  return POST();
}
