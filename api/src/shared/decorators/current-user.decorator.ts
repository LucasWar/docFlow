import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CurrentUserType } from 'src/modules/auth/types/current-user.type';

export type AuthenticatedRequest = Request & {
  user: CurrentUserType;
};

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();

    return request.user.userId;
  },
);
