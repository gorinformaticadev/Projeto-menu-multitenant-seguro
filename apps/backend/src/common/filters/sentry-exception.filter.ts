import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import { getRequestTrace, type RequestTraceContext } from '../http/request-trace.util';

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';
    const trace = getRequestTrace(
      request as unknown as { requestTrace?: RequestTraceContext },
    );

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
        user: (request as any).user
          ? {
            id: (request as any).user.id,
            email: (request as any).user.email,
            role: (request as any).user.role,
          }
          : undefined,
      });
    }

    // Retornar resposta ao cliente
    if (response.headersSent) {
      return;
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: trace?.requestId || null,
      traceId: trace?.traceId || null,
      message: typeof message === 'string' ? message : (message as any).message,
    });
  }
}
