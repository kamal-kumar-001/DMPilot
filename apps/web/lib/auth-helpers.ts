import { signOut } from 'next-auth/react';

/**
 * Robust single-click logout handler that:
 * 1. Invokes /api/auth/logout to expire all NextAuth session cookies and chunks on the server.
 * 2. Clears client storage (localStorage, sessionStorage).
 * 3. Sets a temporary 'just_logged_out' flag so login/register pages never auto-redirect to dashboard.
 * 4. Calls NextAuth client signOut and redirects to /login?logged_out=1.
 */
export const handleLogout = async () => {
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem('just_logged_out', '1');
      sessionStorage.clear();
      sessionStorage.setItem('just_logged_out', '1');
      localStorage.clear();

      // Clear all accessible cookies
      document.cookie.split(';').forEach((c) => {
        const name = c.split('=')[0].trim();
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      });

      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors
    }

    try {
      await signOut({ callbackUrl: '/login?logged_out=1', redirect: true });
    } catch {
      window.location.href = '/login?logged_out=1';
    }
  }
};
