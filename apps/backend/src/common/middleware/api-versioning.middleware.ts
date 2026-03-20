import { Injectable, type NestMiddleware } from '@nestjs/common';
import { resolveApiRouteContractPolicy } from '@contracts/api-routes';
import { API_VERSION_HEADER } from '@contracts/http';
import { type NextFunction, type Request, type Response } from 'express';
import { resolveApiVersion, buildApiVersionResponseHeaders } from '../http/api-versioning.util';
import {
  BAGGAGE_HEADER,
  annotateRequestTrace,
  getRequestTrace,
} from '../http/request-trace.util';
import { OperationalObservabilityService } from '../services/operational-observability.service';

type VersionedRequest = Request & {
  apiVersion?: string;
  apiVersionDefaulted?: boolean;
};

@Injectable()
export class ApiVersioningMiddleware implements NestMiddleware {
  constructor(
    private readonly operationalObservabilityService?: OperationalObservabilityService,
  ) {}

  use(req: VersionedRequest, res: Response, next: NextFunction) {
    const routePolicy = resolveApiRouteContractPolicy(req.originalUrl || req.url || req.path || '/');
    const resolution = resolveApiVersion(
      req.headers[API_VERSION_HEADER],
      routePolicy.supportedVersions,
    );

    if (resolution.ok === false) {
      res.status(406).json({
        statusCode: 406,
        error: 'Not Acceptable',
        message: `Versao de API "${resolution.requestedVersion}" nao suportada.`,
        supportedVersions: resolution.supportedVersions,
        latestVersion: resolution.latestVersion,
      });
      return;
    }

    req.apiVersion = resolution.resolvedVersion;
    req.apiVersionDefaulted = resolution.wasDefaulted;
    const trace = annotateRequestTrace(req as unknown as Record<string, any>, {
      apiVersion: resolution.resolvedVersion,
    });

    if (resolution.resolvedVersion !== resolution.latestVersion) {
      this.operationalObservabilityService?.record({
        type: 'version_fallback',
        route: req.originalUrl || req.url || req.path || '/',
        request: req as unknown as Record<string, any>,
        severity: resolution.wasDefaulted ? 'warn' : 'log',
        detail: resolution.wasDefaulted
          ? `missing ${API_VERSION_HEADER}; defaulted to v${resolution.resolvedVersion} while latest is v${resolution.latestVersion}`
          : `requested v${resolution.resolvedVersion} while latest supported is v${resolution.latestVersion}`,
        extra: {
          routeId: routePolicy.id,
          resolvedVersion: resolution.resolvedVersion,
          latestVersion: resolution.latestVersion,
          wasDefaulted: resolution.wasDefaulted,
        },
      });
    }

    const headers = buildApiVersionResponseHeaders(resolution);
    for (const [headerName, headerValue] of Object.entries(headers)) {
      if (headerName.toLowerCase() === 'vary') {
        res.append(headerName, headerValue);
        continue;
      }
      res.setHeader(headerName, headerValue);
    }
    const baggageTrace = trace || getRequestTrace(req as unknown as Record<string, any>);
    if (baggageTrace?.apiVersion) {
      const baggageEntries = [
        baggageTrace.tenantId ? `tenant_id=${baggageTrace.tenantId}` : null,
        baggageTrace.userId ? `user_id=${baggageTrace.userId}` : null,
        baggageTrace.apiVersion ? `api_version=${baggageTrace.apiVersion}` : null,
        baggageTrace.mitigationFlags.length > 0
          ? `mitigation_flags=${baggageTrace.mitigationFlags.join('.')}`
          : null,
      ]
        .filter(Boolean)
        .join(',');
      if (baggageEntries) {
        res.setHeader(BAGGAGE_HEADER, baggageEntries);
      }
    }

    next();
  }
}
