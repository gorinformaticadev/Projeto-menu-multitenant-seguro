import { Injectable, NestMiddleware } from '@nestjs/common';
import { RequestSecurityContextService } from '../services/request-security-context.service';

@Injectable()
export class RequestSecurityContextMiddleware implements NestMiddleware {
  constructor(private readonly requestSecurityContext: RequestSecurityContextService) {}

  use(req: any, _res: any, next: () => void): void {
    this.requestSecurityContext.runWithRequest(req, next);
  }
}
