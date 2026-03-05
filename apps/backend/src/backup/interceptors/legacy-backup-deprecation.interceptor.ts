import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';

@Injectable()
export class LegacyBackupDeprecationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse<Response>();
    response.setHeader('X-API-Deprecated', 'true');
    response.setHeader('Deprecation', 'true');
    response.setHeader('Link', '</api/backups>; rel="successor-version"');
    response.setHeader('Warning', '299 - "Deprecated endpoint. Use /api/backups/*"');
    return next.handle();
  }
}
