import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthenticateGuard } from 'src/shared/guards/auth.guard';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';
import type { CurrentUserType } from '../auth/types/current-user.type';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(AuthenticateGuard)
  findAll() {
    return this.usersService.findAll();
  }

  @Get('me')
  @UseGuards(AuthenticateGuard)
  me(@CurrentUser() user: CurrentUserType) {
    return this.usersService.me(user);
  }
}
