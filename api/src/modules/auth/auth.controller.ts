import {
  Controller,
  Post,
  Body,
  Res,
  UseInterceptors,
  HttpCode,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import type { Response } from 'express';
import { CurrentRefreshToken } from 'src/shared/decorators/current-refresk-token.decorator';
import { IdempotencyInteceptor } from 'src/shared/interceptors/idempontecy-key.interceptor';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('teste')
  teste() {
    return 'ola';
  }

  @Post('register')
  @UseInterceptors(IdempotencyInteceptor)
  async create(@Body() registerUserDto: RegisterUserDto) {
    return await this.authService.register(registerUserDto);
  }

  @Post('login')
  async login(
    @Body() loginUserDto: LoginUserDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, refreshToken } =
      await this.authService.authenticate(loginUserDto);

    response.cookie('refresh_token', refreshToken, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
    });

    return { accessToken };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @CurrentRefreshToken() refreshTokenReq: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.closeSession(refreshTokenReq);
    response.clearCookie('refresh_token', {
      httpOnly: true,
    });
  }

  @Post('refresh')
  async refresh(
    @CurrentRefreshToken() refreshTokenReq: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, refreshToken } =
      await this.authService.refresh(refreshTokenReq);

    response.cookie('refresh_token', refreshToken, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
    });

    return { accessToken };
  }
}
