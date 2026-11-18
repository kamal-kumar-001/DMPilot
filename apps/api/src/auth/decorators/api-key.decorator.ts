import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** The authenticated Personal Access Token context, or undefined for session JWT users. */
export const GetApiKey = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.apiKey as
    { id: string; scopes: string[]; instagramAccountIds: string[] } | undefined;
});
