import { HttpException } from '@nestjs/common';
import { ErrorCode } from '../enum/ErroCode.enum';

export class AppException extends HttpException {
  public readonly errorCode: string;
  public readonly originalError: any;

  constructor(
    message: string,
    errorCode: ErrorCode,
    statusCode: number,
    originalError?: any,
  ) {
    super({ message, errorCode }, statusCode);
    this.errorCode = errorCode;
    this.originalError = originalError;

    if (originalError instanceof Error && originalError.stack) {
      this.stack = originalError.stack;
    }

    Object.setPrototypeOf(this, AppException.prototype);
  }
}
