import { Injectable, type NestMiddleware } from '@nestjs/common';
import { resolveApiRouteContractPolicy } from '@contracts/api-routes';
import type { NextFunction, Request, Response } from 'express';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { OperationalObservabilityService } from '../services/operational-observability.service';

@Injectable()
export class ResponseProtectionMiddleware implements NestMiddleware {
  constructor(
    private readonly operationalObservabilityService?: OperationalObservabilityService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const routePolicy = resolveApiRouteContractPolicy(req.originalUrl || req.url || req.path || '/');
    const originalSend = res.send.bind(res);
    const originalJson = res.json.bind(res);

    const finalizeResponse = (payloadBuffer: Buffer, contentType: string) => {
      let finalBuffer = payloadBuffer;
      const acceptedEncodings = String(req.headers['accept-encoding'] || '').toLowerCase();
      const shouldCompress =
        routePolicy.response.compress &&
        payloadBuffer.length >= routePolicy.response.compressionThresholdBytes &&
        isCompressibleContentType(contentType);

      if (shouldCompress) {
        if (acceptedEncodings.includes('br')) {
          finalBuffer = brotliCompressSync(payloadBuffer);
          res.setHeader('Content-Encoding', 'br');
        } else if (acceptedEncodings.includes('gzip')) {
          finalBuffer = gzipSync(payloadBuffer);
          res.setHeader('Content-Encoding', 'gzip');
        }
      }

      if (shouldCompress) {
        appendVaryHeader(res, 'Accept-Encoding');
      }

      if (finalBuffer.length > routePolicy.response.maxBytes) {
        const errorStatus = routePolicy.response.overflowStatusCode;
        this.operationalObservabilityService?.record({
          type: 'response_overflow',
          route: req.originalUrl || req.url || req.path || '/',
          request: req as unknown as Record<string, any>,
          statusCode: errorStatus,
          severity: 'warn',
          detail: `response ${finalBuffer.length} exceeds ${routePolicy.response.maxBytes} bytes for ${routePolicy.id}`,
          extra: {
            routeId: routePolicy.id,
            responseBytes: finalBuffer.length,
            limitBytes: routePolicy.response.maxBytes,
          },
        });
        const errorBody = Buffer.from(
          JSON.stringify({
            statusCode: errorStatus,
            error: errorStatus === 413 ? 'Payload Too Large' : 'Unprocessable Content',
            code: 'RESPONSE_TOO_LARGE',
            message: `Response excede o limite configurado para ${routePolicy.id}. Ajuste a consulta ou utilize paginacao.`,
            routeId: routePolicy.id,
            limitBytes: routePolicy.response.maxBytes,
          }),
        );

        res.status(errorStatus);
        res.removeHeader('Content-Encoding');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Length', String(errorBody.length));
        return originalSend(errorBody);
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', String(finalBuffer.length));
      return originalSend(finalBuffer);
    };

    res.json = ((body: unknown) => {
      return finalizeResponse(
        Buffer.from(JSON.stringify(body ?? null)),
        'application/json; charset=utf-8',
      );
    }) as typeof res.json;

    res.send = ((body: unknown) => {
      if (body === undefined || body === null) {
        return originalSend(body as never);
      }

      const responseContentType = String(
        res.getHeader('Content-Type') || detectContentType(body),
      );

      if (Buffer.isBuffer(body)) {
        if (!isCompressibleContentType(responseContentType)) {
          return originalSend(body);
        }
        return finalizeResponse(body, responseContentType);
      }

      if (typeof body === 'string') {
        return finalizeResponse(Buffer.from(body), responseContentType);
      }

      if (typeof body === 'object') {
        return finalizeResponse(
          Buffer.from(JSON.stringify(body)),
          'application/json; charset=utf-8',
        );
      }

      return originalSend(body as never);
    }) as typeof res.send;

    res.locals.contractRoutePolicy = routePolicy;
    res.locals.originalJson = originalJson;
    next();
  }
}

function isCompressibleContentType(contentType: string): boolean {
  const normalized = String(contentType || '').toLowerCase();
  return (
    normalized.includes('application/json') ||
    normalized.startsWith('text/') ||
    normalized.includes('application/javascript') ||
    normalized.includes('image/svg+xml')
  );
}

function detectContentType(body: unknown): string {
  if (typeof body === 'string') {
    return 'text/plain; charset=utf-8';
  }

  return 'application/json; charset=utf-8';
}

function appendVaryHeader(res: Response, headerValue: string) {
  const currentValue = String(res.getHeader('Vary') || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!currentValue.includes(headerValue)) {
    currentValue.push(headerValue);
  }

  res.setHeader('Vary', currentValue.join(', '));
}
