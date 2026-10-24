import type { ExecutionContext } from '@nestjs/common';
import { BadRequestException, createParamDecorator } from '@nestjs/common';

export const UserInfo = createParamDecorator(
  (
    data: keyof NonNullable<Express.Request['user']> | undefined,
    ctx: ExecutionContext,
  ) => {
    const request = ctx.switchToHttp().getRequest<Express.Request>();
    const user = request.user;

    if (!user) {
      throw new BadRequestException('کاربر لاگین نکرده است');
    }
    if (data === 'sub') {
      return user.sub;
    }
    if (data) {
      return user[data];
    }
    return user;
  },
);
