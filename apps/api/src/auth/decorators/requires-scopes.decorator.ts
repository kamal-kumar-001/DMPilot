import { SetMetadata } from '@nestjs/common';

export const REQUIRES_SCOPES_KEY = 'requiresScopes';

/**
 * Marks a route as part of the Personal Access Token surface and names the
 * scopes a key must hold. Routes WITHOUT this metadata are denied for
 * API-key-authenticated requests (session JWT is unaffected).
 */
export const RequiresScopes = (...scopes: string[]) => SetMetadata(REQUIRES_SCOPES_KEY, scopes);
