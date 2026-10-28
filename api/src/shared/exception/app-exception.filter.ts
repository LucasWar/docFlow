import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { AppException } from './app.exception';
import { ValidationError } from 'class-validator';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';
    let errorCode = 'INTERNAL_ERROR';

    if (exception instanceof AppException) {
      status = exception.getStatus();
      message = exception.message;
      errorCode = exception.errorCode;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse() as any;

      if (
        typeof res === 'object' &&
        res !== null &&
        Array.isArray(res.message) &&
        res.message[0] instanceof ValidationError
      ) {
        const validationError = this.findFirstError(res.message);

        if (validationError.constraints) {
          message = Object.values(validationError.constraints)[0];
        }

        if (validationError.contexts) {
          const firstContext = Object.values(
            validationError.contexts,
          )[0] as any;
          if (firstContext) {
            errorCode = firstContext.erroCode || errorCode;

            status = firstContext.statusCode || status;
          }
        } else {
          errorCode = 'VALIDATION_ERROR';
        }
      } else if (typeof res === 'object' && res !== null) {
        message = res.message || message;
        errorCode = res.errorCode || errorCode;
      } else if (typeof res === 'string') {
        message = res;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    response.status(status).json({
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      errorCode,
    });
  }

  private findFirstError(errors: ValidationError[]): ValidationError {
    const error = errors[0];
    if (error.children && error.children.length > 0) {
      return this.findFirstError(error.children);
    }
    return error;
  }
}
