import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { RequestSecurityContextService } from '../services/request-security-context.service';

@Injectable()
export class RequestSecurityContextMiddleware implements NestMiddleware {
  constructor(private readonly requestSecurityContext: RequestSecurityContextService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    this.requestSecurityContext.runWithRequest(req, next);
  }
}
