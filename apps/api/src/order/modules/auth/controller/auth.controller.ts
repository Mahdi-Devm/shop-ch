import { Public } from '@common/auth/auth.decorators';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { LoginDto, LoginResponse } from '../dto/login.dto';
import { AuthService } from '../service/auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() credentials: LoginDto): Promise<LoginResponse> {
    return this.authService.login(credentials);
  }
}
