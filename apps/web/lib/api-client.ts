import { ApiResponse } from '@autodm/types';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export class ApiError extends Error {
  code: string;
  details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

function getFriendlyErrorMessage(message: string): string {
  const msg = message.toLowerCase();

  if (
    msg.includes('unique constraint') ||
    msg.includes('duplicate key') ||
    msg.includes('mediaid')
  ) {
    return 'This Instagram post is already being monitored by another campaign.';
  }
  if (msg.includes('prisma') || msg.includes('database') || msg.includes('invocation')) {
    return 'We encountered a database validation issue. Please check your settings.';
  }
  if (msg.includes('token exchange') || msg.includes('oauth') || msg.includes('meta oauth')) {
    return 'Instagram authentication failed. Please check your Instagram Professional account settings.';
  }
  if (msg.includes('no connected instagram business accounts')) {
    return 'No Instagram Professional accounts found. Please ensure your account is set to Business or Creator.';
  }
  if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('connection')) {
    return 'Unable to connect to the server. Please check your internet connection.';
  }

  return message;
}

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const headers = new Headers(options?.headers);
  headers.set('ngrok-skip-browser-warning', 'true');
  if (!headers.has('Content-Type') && !(options?.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Automatically fetch active session JWT and inject Authorization header if not provided
  if (
    !headers.has('Authorization') &&
    typeof window !== 'undefined' &&
    typeof window.document !== 'undefined'
  ) {
    try {
      const sessionRes = await fetch('/api/auth/session');
      if (sessionRes.ok) {
        const session = await sessionRes.json();
        const jwt = (session as { accessToken?: string })?.accessToken;
        if (jwt) {
          headers.set('Authorization', `Bearer ${jwt}`);
        }
      }
    } catch (e) {
      // Session fetch failed or not logged in, proceed without auth header
    }
  }

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      ...options,
      headers,
    });

    const result = await response.json();

    if (!response.ok) {
      const rawMessage =
        result?.error?.message ||
        (Array.isArray(result?.message) ? result.message.join(', ') : result?.message) ||
        result?.error ||
        'An unexpected error occurred';

      const friendlyMessage = getFriendlyErrorMessage(rawMessage);

      throw new ApiError(
        friendlyMessage,
        result?.error?.code || result?.statusCode || 'SERVER_ERROR',
        result?.error?.details || result,
      );
    }

    const successData = result as ApiResponse<T>;
    return successData.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    const errMsg = error instanceof Error ? error.message : 'A connection error occurred';
    throw new ApiError(getFriendlyErrorMessage(errMsg), 'CONNECTION_ERROR');
  }
}

/**
 * Lightweight authenticated fetch helper for components that need raw control
 * over the request (e.g. non-JSON endpoints, streaming). Automatically injects
 * the session JWT and unwraps the `{ success, data }` envelope when present.
 */
export async function fetchWithAuth<T>(path: string, options?: RequestInit): Promise<T> {
  const sessionRes = await fetch('/api/auth/session');
  const session = await sessionRes.json();
  const jwt = (session as { accessToken?: string })?.accessToken;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      ...(options?.headers ?? {}),
    },
    cache: 'no-store',
  });

  if (!res.ok) throw new Error(`${res.status}`);
  const json = await res.json();

  return json && typeof json === 'object' && 'success' in json && 'data' in json
    ? (json.data as T)
    : (json as T);
}
