import type { AccessTokenPayload } from '@common/auth/authenticated-user';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { OrderEnvironment } from '@order/config/order-environment';
import type { LoginDto, LoginResponse } from '../dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<OrderEnvironment, true>,
  ) {}

  async login(credentials: LoginDto): Promise<LoginResponse> {
    const payload: AccessTokenPayload = { sub: credentials.username };
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: this.configService.get('JWT_EXPIRES_IN_SECONDS', {
        infer: true,
      }),
    });

    return { access_token: accessToken, userId: credentials.username };
  }
}
