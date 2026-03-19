import { Injectable, type NestMiddleware } from '@nestjs/common';
import {
  DEFAULT_REQUEST_CONTRACT_LIMITS,
  resolveApiRouteContractPolicy,
  type RequestContractLimits,
} from '@contracts/api-routes';
import { json, urlencoded } from 'express';
import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from 'express';
import { OperationalObservabilityService } from '../services/operational-observability.service';

export const PAYLOAD_PROTECTION_LIMITS = DEFAULT_REQUEST_CONTRACT_LIMITS;

type PayloadValidationIssue = {
  statusCode: 400 | 408 | 413;
  error: 'Bad Request' | 'Request Timeout' | 'Payload Too Large';
  code:
    | 'PAYLOAD_TOO_LARGE'
    | 'PAYLOAD_TIMEOUT'
    | 'PAYLOAD_TOO_DEEP'
    | 'PAYLOAD_TOO_WIDE'
    | 'PAYLOAD_TOO_COMPLEX'
    | 'PAYLOAD_STRING_TOO_LARGE'
    | 'PAYLOAD_KEY_TOO_LARGE'
    | 'PAYLOAD_DANGEROUS_KEY'
    | 'PAYLOAD_UNSUPPORTED_OBJECT';
  message: string;
};

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const DANGEROUS_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export function createContentLengthLimitMiddleware(
  operationalObservabilityService?: OperationalObservabilityService,
): RequestHandler {
  return (req, res, next) => {
    if (!BODY_METHODS.has(String(req.method || '').toUpperCase())) {
      next();
      return;
    }

    const contentLength = Number(req.headers['content-length']);
    if (!Number.isFinite(contentLength) || contentLength <= 0) {
      next();
      return;
    }

    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    const routePolicy = resolveApiRouteContractPolicy(req.originalUrl || req.url || req.path || '/');
    const requestLimits = routePolicy.request;
    const bodyLimit = contentType.includes('multipart/form-data')
      ? requestLimits.multipartBytes
      : contentType.includes('application/x-www-form-urlencoded')
        ? requestLimits.urlencodedBytes
        : requestLimits.jsonBytes;

    if (contentLength > bodyLimit) {
      operationalObservabilityService?.record({
        type: 'payload_rejected',
        route: req.originalUrl || req.url || req.path || '/',
        request: req as unknown as Record<string, any>,
        statusCode: 413,
        severity: 'warn',
        detail: `content-length ${contentLength} exceeds ${bodyLimit} bytes`,
      });
      respondWithPayloadIssue(
        res,
        buildPayloadIssue(
          413,
          'PAYLOAD_TOO_LARGE',
          `Payload excede o limite permitido de ${bodyLimit} bytes.`,
        ),
      );
      return;
    }

    next();
  };
}

export function createDynamicBodyParserMiddleware(): RequestHandler {
  return (req, res, next) => {
    if (!BODY_METHODS.has(String(req.method || '').toUpperCase())) {
      next();
      return;
    }

    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    const routePolicy = resolveApiRouteContractPolicy(req.originalUrl || req.url || req.path || '/');

    if (contentType.includes('multipart/form-data')) {
      next();
      return;
    }

    if (contentType.includes('application/x-www-form-urlencoded')) {
      urlencoded({
        extended: false,
        limit: `${routePolicy.request.urlencodedBytes}b`,
        parameterLimit: routePolicy.request.maxObjectKeys,
      })(req, res, next);
      return;
    }

    json({
      limit: `${routePolicy.request.jsonBytes}b`,
      strict: true,
      type: ['application/json', 'application/*+json'],
    })(req, res, next);
  };
}

export function createRequestBodyTimeoutMiddleware(
  operationalObservabilityService?: OperationalObservabilityService,
): RequestHandler {
  return (req, res, next) => {
    if (!BODY_METHODS.has(String(req.method || '').toUpperCase())) {
      next();
      return;
    }

    const routePolicy = resolveApiRouteContractPolicy(req.originalUrl || req.url || req.path || '/');
    const timeoutMs = routePolicy.request.bodyTimeoutMs;

    let settled = false;
    const cleanup = () => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      req.off('end', cleanup);
      req.off('aborted', cleanup);
      req.off('close', cleanup);
      res.off('finish', cleanup);
      res.off('close', cleanup);
    };

    const timer = setTimeout(() => {
      if (settled || res.headersSent) {
        cleanup();
        return;
      }

      cleanup();
      operationalObservabilityService?.record({
        type: 'payload_rejected',
        route: req.originalUrl || req.url || req.path || '/',
        request: req as unknown as Record<string, any>,
        statusCode: 408,
        severity: 'warn',
        detail: `body read exceeded ${timeoutMs}ms`,
      });
      respondWithPayloadIssue(
        res,
        buildPayloadIssue(
          408,
          'PAYLOAD_TIMEOUT',
          `Leitura do body excedeu o tempo limite de ${timeoutMs}ms.`,
        ),
      );

      try {
        req.destroy();
      } catch {}
    }, timeoutMs);

    req.on('end', cleanup);
    req.on('aborted', cleanup);
    req.on('close', cleanup);
    res.on('finish', cleanup);
    res.on('close', cleanup);

    next();
  };
}

export function createBodyParserErrorMiddleware(
  operationalObservabilityService?: OperationalObservabilityService,
): ErrorRequestHandler {
  return (error, req, res, next) => {
    const bodyParserError = error as { type?: string } | undefined;
    const routePolicy = resolveApiRouteContractPolicy(req.originalUrl || req.url || req.path || '/');
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    const bodyLimit = contentType.includes('application/x-www-form-urlencoded')
      ? routePolicy.request.urlencodedBytes
      : routePolicy.request.jsonBytes;

    if (bodyParserError?.type === 'entity.too.large') {
      operationalObservabilityService?.record({
        type: 'request_timeout',
        route: req.originalUrl || req.url || req.path || '/',
        request: req as unknown as Record<string, any>,
        statusCode: 413,
        severity: 'warn',
        detail: `body parser rejected payload larger than ${bodyLimit} bytes`,
      });
      respondWithPayloadIssue(
        res,
        buildPayloadIssue(
          413,
          'PAYLOAD_TOO_LARGE',
          `Payload excede o limite permitido de ${bodyLimit} bytes.`,
        ),
      );
      return;
    }

    if (bodyParserError?.type === 'entity.parse.failed') {
      respondWithPayloadIssue(
        res,
        buildPayloadIssue(400, 'PAYLOAD_UNSUPPORTED_OBJECT', 'Body JSON invalido.'),
      );
      return;
    }

    next(error);
  };
}

@Injectable()
export class PayloadProtectionMiddleware implements NestMiddleware {
  constructor(
    private readonly operationalObservabilityService?: OperationalObservabilityService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    if (!BODY_METHODS.has(String(req.method || '').toUpperCase())) {
      next();
      return;
    }

    const routePolicy = resolveApiRouteContractPolicy(req.originalUrl || req.url || req.path || '/');
    const issue = inspectPayloadValue(req.body, routePolicy.request);
    if (issue) {
      this.operationalObservabilityService?.record({
        type: 'payload_rejected',
        route: req.originalUrl || req.url || req.path || '/',
        request: req as unknown as Record<string, any>,
        statusCode: issue.statusCode,
        severity: 'warn',
        detail: `${issue.code} ${issue.message}`,
      });
      respondWithPayloadIssue(res, issue);
      return;
    }

    next();
  }
}

export function inspectPayloadValue(
  value: unknown,
  limits: RequestContractLimits = PAYLOAD_PROTECTION_LIMITS,
): PayloadValidationIssue | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'object') {
    return inspectLeafValue(value, limits);
  }

  const stack: Array<{ value: unknown; depth: number; path: string }> = [
    { value, depth: 1, path: 'body' },
  ];
  let visitedNodes = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    visitedNodes += 1;
    if (visitedNodes > limits.maxNodes) {
      return buildPayloadIssue(
        413,
        'PAYLOAD_TOO_COMPLEX',
        `Payload excede o limite de ${limits.maxNodes} nos.`,
      );
    }

    if (current.depth > limits.maxDepth) {
      return buildPayloadIssue(
        413,
        'PAYLOAD_TOO_DEEP',
        `Payload excede a profundidade maxima de ${limits.maxDepth}.`,
      );
    }

    const currentValue = current.value;
    if (currentValue === null || currentValue === undefined) {
      continue;
    }

    if (typeof currentValue !== 'object') {
      const leafIssue = inspectLeafValue(currentValue, limits);
      if (leafIssue) {
        return leafIssue;
      }
      continue;
    }

    if (Array.isArray(currentValue)) {
      if (currentValue.length > limits.maxArrayLength) {
        return buildPayloadIssue(
          413,
          'PAYLOAD_TOO_WIDE',
          `Array ${current.path} excede o limite de ${limits.maxArrayLength} itens.`,
        );
      }

      for (let index = currentValue.length - 1; index >= 0; index -= 1) {
        stack.push({
          value: currentValue[index],
          depth: current.depth + 1,
          path: `${current.path}[${index}]`,
        });
      }
      continue;
    }

    if (!isPlainObject(currentValue)) {
      return buildPayloadIssue(
        400,
        'PAYLOAD_UNSUPPORTED_OBJECT',
        `Payload contem objeto nao suportado em ${current.path}.`,
      );
    }

    const entries = Object.entries(currentValue);
    if (entries.length > limits.maxObjectKeys) {
      return buildPayloadIssue(
        413,
        'PAYLOAD_TOO_WIDE',
        `Objeto ${current.path} excede o limite de ${limits.maxObjectKeys} chaves.`,
      );
    }

    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const [key, entryValue] = entries[index];

      if (DANGEROUS_OBJECT_KEYS.has(key)) {
        return buildPayloadIssue(
          400,
          'PAYLOAD_DANGEROUS_KEY',
          `Payload contem chave proibida em ${current.path}.${key}.`,
        );
      }

      if (Buffer.byteLength(key, 'utf8') > limits.maxKeyBytes) {
        return buildPayloadIssue(
          413,
          'PAYLOAD_KEY_TOO_LARGE',
          `Chave ${current.path}.${key} excede o limite de tamanho permitido.`,
        );
      }

      stack.push({
        value: entryValue,
        depth: current.depth + 1,
        path: `${current.path}.${key}`,
      });
    }
  }

  return null;
}

function inspectLeafValue(
  value: unknown,
  limits: RequestContractLimits,
): PayloadValidationIssue | null {
  if (typeof value !== 'string') {
    return null;
  }

  if (Buffer.byteLength(value, 'utf8') > limits.maxStringBytes) {
    return buildPayloadIssue(
      413,
      'PAYLOAD_STRING_TOO_LARGE',
      `String excede o limite de ${limits.maxStringBytes} bytes.`,
    );
  }

  return null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function buildPayloadIssue(
  statusCode: PayloadValidationIssue['statusCode'],
  code: PayloadValidationIssue['code'],
  message: string,
): PayloadValidationIssue {
  return {
    statusCode,
    error:
      statusCode === 413
        ? 'Payload Too Large'
        : statusCode === 408
          ? 'Request Timeout'
          : 'Bad Request',
    code,
    message,
  };
}

function respondWithPayloadIssue(res: Response, issue: PayloadValidationIssue) {
  res.status(issue.statusCode).json({
    statusCode: issue.statusCode,
    error: issue.error,
    code: issue.code,
    message: issue.message,
  });
}
