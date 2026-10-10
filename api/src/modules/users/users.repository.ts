import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma-service.service';
import { CreateUserType } from './types/create-user.type';

@Injectable()
export class UsersRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async findMany() {
    return await this.prismaService.user.findMany();
  }

  async findUserById(id: string) {
    return await this.prismaService.user.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });
  }

  async findOneById(id: string) {
    return await this.prismaService.user.findUnique({
      where: {
        id,
      },
    });
  }

  async createUser(newUser: CreateUserType) {
    return await this.prismaService.user.create({
      data: newUser,
    });
  }

  async findEmail(email: string) {
    return await this.prismaService.user.findUnique({
      where: {
        email,
      },
    });
  }
}
