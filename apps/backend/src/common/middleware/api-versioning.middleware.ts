import { Injectable, type NestMiddleware } from '@nestjs/common';
import { resolveApiRouteContractPolicy } from '@contracts/api-routes';
import { API_VERSION_HEADER } from '@contracts/http';
import { type NextFunction, type Request, type Response } from 'express';
import { resolveApiVersion, buildApiVersionResponseHeaders } from '../http/api-versioning.util';

type VersionedRequest = Request & {
  apiVersion?: string;
  apiVersionDefaulted?: boolean;
};

@Injectable()
export class ApiVersioningMiddleware implements NestMiddleware {
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

    const headers = buildApiVersionResponseHeaders(resolution);
    for (const [headerName, headerValue] of Object.entries(headers)) {
      if (headerName.toLowerCase() === 'vary') {
        res.append(headerName, headerValue);
        continue;
      }
      res.setHeader(headerName, headerValue);
    }

    next();
  }
}
