// Least-privilege scope model for Personal Access Tokens (phase 3 connector security).
// Session JWT users are unaffected; every rule below applies only when a request
// authenticates with a dmp_live_ key.

export const API_KEY_SCOPES = [
  'read',
  'campaigns:write',
  'content:publish',
  'ads:write',
  'webhooks:manage',
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export interface ApiKeyAuthContext {
  id: string;
  scopes: string[];
  instagramAccountIds: string[];
}

export function isValidScope(scope: string): scope is ApiKeyScope {
  return (API_KEY_SCOPES as readonly string[]).includes(scope);
}

/** New keys are read-only unless the user explicitly requests more. */
export const DEFAULT_API_KEY_SCOPES: string[] = ['read'];

/**
 * Fail-closed check for an API-key-authenticated request.
 * requiredScopes === null means the route carries no @RequiresScopes metadata:
 * such routes are NOT part of the PAT surface and must be denied for keys.
 */
export function checkApiKeyRequest(
  key: ApiKeyAuthContext,
  requiredScopes: string[] | null,
  candidateAccountId?: string | null,
): { ok: boolean; reason?: string } {
  if (!requiredScopes || requiredScopes.length === 0) {
    return { ok: false, reason: 'route_not_key_accessible' };
  }
  for (const scope of requiredScopes) {
    if (!key.scopes.includes(scope)) {
      return { ok: false, reason: `missing_scope:${scope}` };
    }
  }
  if (
    candidateAccountId &&
    key.instagramAccountIds.length > 0 &&
    !key.instagramAccountIds.includes(candidateAccountId)
  ) {
    return { ok: false, reason: 'account_not_in_key_scope' };
  }
  return { ok: true };
}

/** Best-effort extraction of the Instagram account a request targets. */
export function extractCandidateAccountId(req: {
  body?: Record<string, unknown>;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
}): string | null {
  const fromBody = req.body?.instagramAccountId ?? req.body?.accountId;
  if (typeof fromBody === 'string' && fromBody) return fromBody;
  const fromParams = req.params?.accountId;
  if (typeof fromParams === 'string' && fromParams) return fromParams;
  const fromQuery = req.query?.accountId;
  if (typeof fromQuery === 'string' && fromQuery) return fromQuery;
  return null;
}
