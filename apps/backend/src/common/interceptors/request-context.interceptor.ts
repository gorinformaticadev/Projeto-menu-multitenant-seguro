import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

export interface RequestContextPayload {
  ip: string | null;
  userAgent: string | null;
}

export const extractRequestContext = (request: any): RequestContextPayload => {
  const forwardedFor = request?.headers?.['x-forwarded-for'];
  const forwardedValue = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  const firstForwardedIp =
    typeof forwardedValue === 'string'
      ? forwardedValue
          .split(',')
          .map((item) => item.trim())
          .find((item) => item.length > 0) || null
      : null;

  const requestIp = typeof request?.ip === 'string' ? request.ip.trim() : '';
  const socketIp =
    typeof request?.socket?.remoteAddress === 'string' ? request.socket.remoteAddress.trim() : '';

  const rawUserAgent = request?.headers?.['user-agent'];
  const userAgentValue = Array.isArray(rawUserAgent) ? rawUserAgent[0] : rawUserAgent;
  const userAgent = typeof userAgentValue === 'string' ? userAgentValue.trim() : '';

  return {
    ip: firstForwardedIp || requestIp || socketIp || null,
    userAgent: userAgent || null,
  };
};

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    if (request) {
      request.requestCtx = extractRequestContext(request);
    }

    return next.handle();
  }
}
