import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersRepository } from './users.repository';
import { CredentialsUserType } from './types/validate-credentials.type';
import { CurrentUserType } from '../auth/types/current-user.type';
import { AppException } from 'src/shared/exception/app.exception';
import { ErrorCode } from 'src/shared/enum/ErroCode.enum';

@Injectable()
export class UsersService {
  constructor(private readonly userRepository: UsersRepository) {}

  async create(createUserDto: CreateUserDto) {
    const { email } = createUserDto;

    await this.validateUniqueEmail(email);

    return await this.userRepository.createUser(createUserDto);
  }

  async findAll() {
    return await this.userRepository.findMany();
  }

  async me(userId: string) {
    return await this.userRepository.findUserById(userId);
  }

  async findOneUserById(id: string) {
    const user = await this.userRepository.findOneById(id);

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return user;
  }

  async validateCredentials(credentials: CredentialsUserType) {
    const { email, passworld } = credentials;

    const user = await this.userRepository.findEmail(email);

    if (!user) {
      throw new AppException(
        'Email não cadastrado',
        ErrorCode.EMAIL_NOT_REGISTRED,
        404,
      );
    }

    const validatePassworld = await bcrypt.compare(
      passworld,
      user.passworldHash,
    );

    if (!validatePassworld) {
      throw new AppException(
        'Credenciais invalidas',
        ErrorCode.INVALID_CREDENTIALS,
        401,
      );
    }

    return user;
  }

  async validateUniqueEmail(email: string): Promise<void> {
    const ownerEmail = await this.userRepository.findEmail(email);

    if (ownerEmail) {
      throw new ConflictException('Email ja registrado');
    }
  }
}
