import {
  ALLOW_QUERY_TOKEN_KEY,
  IS_PUBLIC_KEY,
} from '@common/auth/auth.decorators';
import type { AccessTokenPayload } from '@common/auth/authenticated-user';
import { ApiException } from '@common/exceptions/api.exception';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

function bearerToken(request: Request): string | undefined {
  const [scheme, token] = (request.headers.authorization ?? '').split(' ');
  return scheme === 'Bearer' && token ? token : undefined;
}

function queryToken(request: Request): string | undefined {
  const token = request.query.token;
  return typeof token === 'string' && token.length > 0 ? token : undefined;
}

function isAccessTokenPayload(value: unknown): value is AccessTokenPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { sub?: unknown }).sub === 'string' &&
    (value as { sub: string }).sub.length > 0
  );
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const allowsQueryToken = this.reflector.getAllAndOverride<boolean>(
      ALLOW_QUERY_TOKEN_KEY,
      targets,
    );
    const token =
      bearerToken(request) ??
      (allowsQueryToken ? queryToken(request) : undefined);

    if (!token) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED');
    }

    const payload = await this.verify(token);
    request.user = { userId: payload.sub };
    return true;
  }

  private async verify(token: string): Promise<AccessTokenPayload> {
    try {
      const payload: unknown = await this.jwtService.verifyAsync(token);
      if (isAccessTokenPayload(payload)) {
        return payload;
      }
    } catch {
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED');
    }
    throw new ApiException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED');
  }
}
