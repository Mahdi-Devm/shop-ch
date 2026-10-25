import type { AuthenticatedUser } from '@common/auth/authenticated-user';
import type { ExecutionContext } from '@nestjs/common';
import {
  createParamDecorator,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const ALLOW_QUERY_TOKEN_KEY = 'auth:allowQueryToken';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const AllowQueryToken = () => SetMetadata(ALLOW_QUERY_TOKEN_KEY, true);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.user) {
      throw new UnauthorizedException();
    }
    return request.user;
  },
);
