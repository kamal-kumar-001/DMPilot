import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Optional,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ApiKeyService } from '../api-key.service';
import { REQUIRES_SCOPES_KEY } from '../decorators/requires-scopes.decorator';
import { checkApiKeyRequest, extractCandidateAccountId } from '../utils/api-key-scopes';

/** Routes a restricted (account-scoped) key can never call because they cannot be account-filtered. */
const RESTRICTED_KEY_UNSUPPORTED_ROUTES = [
  /^\/instagram\/conversations/,
  /^\/instagram\/reply-desk/,
];

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    @Optional() private readonly apiKeyService?: ApiKeyService,
    @Optional() private readonly reflector?: Reflector,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    const apiKeyHeader = request.headers['x-api-key'];

    let candidateKey: string | null = null;
    if (typeof apiKeyHeader === 'string' && apiKeyHeader.trim()) {
      candidateKey = apiKeyHeader.trim();
    } else if (typeof authHeader === 'string' && authHeader.trim()) {
      const parts = authHeader.split(' ');
      if (
        parts.length === 2 &&
        parts[0].toLowerCase() === 'bearer' &&
        parts[1].startsWith('dmp_live_')
      ) {
        candidateKey = parts[1].trim();
      }
    }

    if (candidateKey) {
      if (!this.apiKeyService) {
        throw new UnauthorizedException('API key authentication service not available');
      }

      const result = await this.apiKeyService.validateApiKey(candidateKey);
      if (!result) {
        throw new UnauthorizedException('Invalid or expired Personal Access Token / API Key');
      }

      // Least-privilege enforcement, fail closed: a key may only call routes
      // decorated with @RequiresScopes, must hold every required scope, and is
      // limited to its chosen Instagram accounts when it carries a restriction.
      const requiredScopes =
        this.reflector?.getAllAndOverride<string[]>(REQUIRES_SCOPES_KEY, [
          context.getHandler(),
          context.getClass(),
        ]) ?? null;
      const check = checkApiKeyRequest(
        result.apiKey,
        requiredScopes,
        extractCandidateAccountId(request),
      );
      if (!check.ok) {
        throw new ForbiddenException(`API key not authorized for this route (${check.reason})`);
      }

      // Route-aware account allowlist: body/query/params variants and
      // resource ids resolved to their owning Instagram account.
      const access = await this.apiKeyService.assertKeyAccountAccess(result.apiKey, request);
      if (!access.ok) {
        throw new ForbiddenException(`API key not authorized for this account (${access.reason})`);
      }

      // Attach user + key context so downstream controllers, @GetUser and the
      // RolesGuard work identically and can tell key auth from session auth.
      request.user = result.user;
      request.apiKey = result.apiKey;

      // Restricted keys cannot use routes that cannot be account-filtered.
      const routePath = (request.routeOptions?.url || request.path || request.url || '').split(
        '?',
      )[0];
      if (
        result.apiKey.instagramAccountIds.length > 0 &&
        RESTRICTED_KEY_UNSUPPORTED_ROUTES.some((pattern) => pattern.test(routePath))
      ) {
        throw new ForbiddenException(
          'API key not authorized for this route (route_not_scopable_for_restricted_key)',
        );
      }

      // Per-action audit attribution for every key-authenticated call,
      // logging the route template only (never query strings or secrets).
      // Mutation audit failures fail the request closed.
      if (request.method && request.method !== 'GET') {
        await this.apiKeyService.recordKeyActionStrict(
          result.apiKey.id,
          result.user.id,
          request.method,
          routePath,
        );
      } else {
        this.apiKeyService.recordKeyAction(
          result.apiKey.id,
          result.user.id,
          request.method || 'GET',
          routePath,
        );
      }
      return true;
    }

    // Default to standard Passport JWT authentication
    return super.canActivate(context) as Promise<boolean>;
  }
}
