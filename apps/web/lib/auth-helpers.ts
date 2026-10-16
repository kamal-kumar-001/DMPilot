import { signOut } from 'next-auth/react';

/**
 * Robust single-click logout handler that:
 * 1. Invokes /api/auth/logout to expire NextAuth session cookies immediately on the server.
 * 2. Clears client storage (localStorage, sessionStorage).
 * 3. Calls NextAuth client signOut without automatic client redirect.
 * 4. Performs a full window reload/navigation to /login?logged_out=1, preventing Next.js router cache
 *    or stale in-memory useSession state from redirecting back to /dashboard.
 */
export const handleLogout = async () => {
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.clear();
      localStorage.clear();
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore errors if offline or network fails
    }

    try {
      await signOut({ redirect: false });
    } catch {
      // Ignore client signOut failure
    }

    // Hard navigate to ensure fresh router state and clean NextAuth provider
    window.location.href = '/login?logged_out=1';
  }
};
