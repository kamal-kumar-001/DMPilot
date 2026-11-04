// Use runtime display mode, never viewport width or whether install is available.
export function isStandaloneLaunch(mode: boolean, iosStandalone?: boolean, referrer = ''): boolean {
  return mode || iosStandalone === true || referrer.startsWith('android-app://');
}

export function pwaLaunchTarget(status: string, sessionError?: string): string | null {
  if (status === 'loading') return null;
  return status === 'authenticated' && sessionError !== 'RefreshAccessTokenError'
    ? '/dashboard'
    : '/login';
}
