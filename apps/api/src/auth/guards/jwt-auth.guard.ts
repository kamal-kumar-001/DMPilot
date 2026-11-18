import { ExecutionContext, Injectable, UnauthorizedException, Optional } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiKeyService } from '../api-key.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(@Optional() private readonly apiKeyService?: ApiKeyService) {
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

      const user = await this.apiKeyService.validateApiKey(candidateKey);
      if (!user) {
        throw new UnauthorizedException('Invalid or expired Personal Access Token / API Key');
      }

      // Attach user to request so downstream controllers and @GetUser decorator work identically
      request.user = user;
      return true;
    }

    // Default to standard Passport JWT authentication
    return super.canActivate(context) as Promise<boolean>;
  }
}
