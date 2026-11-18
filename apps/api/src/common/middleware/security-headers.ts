/**
 * Baseline security headers on every API response (no helmet dependency).
 * Exported so the header contract can be tested without bootstrapping the app.
 * Structural types keep this module free of an express type dependency.
 */
interface HeaderResponse {
  setHeader(name: string, value: string): void;
  removeHeader(name: string): void;
}

export function securityHeaders(_req: unknown, res: HeaderResponse, next: () => void): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.removeHeader('X-Powered-By');
  next();
}
