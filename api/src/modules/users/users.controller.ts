import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthenticateGuard } from 'src/shared/guards/auth.guard';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // @Get()
  // @UseGuards(AuthenticateGuard)
  // findAll() {
  //   return this.usersService.findAll();
  // }

  @Get('me')
  @UseGuards(AuthenticateGuard)
  me(@CurrentUser() userId: string) {
    return this.usersService.me(userId);
  }
}
