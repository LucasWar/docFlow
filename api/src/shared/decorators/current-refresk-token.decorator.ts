import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentRefreshToken = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const currentRefreshToken = ctx.switchToHttp().getRequest().cookies[
      'refresh_token'
    ] as string;

    return currentRefreshToken;
  },
);
