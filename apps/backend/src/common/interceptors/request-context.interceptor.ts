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

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
  requestCtx?: RequestContextPayload;
};

export const extractRequestContext = (request: RequestLike): RequestContextPayload => {
  const realIp = request?.headers?.['x-real-ip'];
  const forwardedFor = request?.headers?.['x-forwarded-for'];
  
  const realIpValue = Array.isArray(realIp) ? realIp[0] : realIp;
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
    ip: realIpValue || firstForwardedIp || requestIp || socketIp || null,
    userAgent: userAgent || null,
  };
};

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestLike>();
    if (request) {
      request.requestCtx = extractRequestContext(request);
    }

    return next.handle();
  }
}
