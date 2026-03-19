import { NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import {
  ensureRequestTrace,
  REQUEST_ID_HEADER,
  TRACE_ID_HEADER,
} from '../http/request-trace.util';

export class RequestTraceMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const trace = ensureRequestTrace(req as Request & { headers: Record<string, string | string[] | undefined> });
    res.setHeader(REQUEST_ID_HEADER, trace.requestId);
    res.setHeader(TRACE_ID_HEADER, trace.traceId);
    next();
  }
}

