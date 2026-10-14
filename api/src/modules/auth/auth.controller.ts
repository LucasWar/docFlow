import {
  Controller,
  Post,
  Body,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import type { Response } from 'express';
import { AuthenticateGuard } from 'src/shared/guards/auth.guard';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';
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
  @UseGuards(AuthenticateGuard)
  async logout(
    @CurrentUser() userId: string,
    @CurrentRefreshToken() refreshTokenReq: string,
    @Res() response: Response,
  ) {
    await this.authService.closeSession(userId, refreshTokenReq);
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
