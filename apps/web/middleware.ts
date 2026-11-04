import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/login',
  },
});

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/automations/:path*',
    '/inbox/:path*',
    '/analytics/:path*',
    '/reply-desk/:path*',
    '/delivery-logs/:path*',
    '/settings/:path*',
    '/admin/:path*',
  ],
};
