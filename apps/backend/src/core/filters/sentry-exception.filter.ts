import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';

type RequestUser = {
  id?: string;
  email?: string;
  role?: string;
};

type RequestWithUser = Request & {
  user?: RequestUser;
};

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithUser>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    // Capturar no Sentry apenas erros 500+
    if (status >= 500) {
      Sentry.captureException(exception, {
        contexts: {
          http: {
            method: request.method,
            url: request.url,
            status_code: status,
          },
        },
        user: request.user
          ? {
            id: request.user.id,
            email: request.user.email,
            role: request.user.role,
          }
          : undefined,
      });
    }

    // Retornar resposta ao cliente
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: typeof message === 'string' ? message : this.readMessageFromResponse(message),
    });
  }

  private readMessageFromResponse(message: object): string {
    const maybeMessage = (message as { message?: unknown }).message;
    return typeof maybeMessage === 'string' ? maybeMessage : 'Internal server error';
  }
}
