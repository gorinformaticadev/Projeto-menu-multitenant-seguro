import { HttpStatus, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { resolveApiRouteContractPolicy } from '@contracts/api-routes';
import { annotateRequestTrace } from '../http/request-trace.util';
import { OperationalObservabilityService } from '../services/operational-observability.service';
import { RuntimePressureService } from '../services/runtime-pressure.service';

const SAFE_RUNTIME_PRESSURE_PATHS = new Set(['/health', '/health/ping', '/health/websocket']);

export class RuntimePressureMiddleware implements NestMiddleware {
  constructor(
    private readonly runtimePressureService: RuntimePressureService,
    private readonly operationalObservabilityService: OperationalObservabilityService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const path = String(req.originalUrl || req.url || req.path || '/');
    const normalizedPath = path.split('?')[0];
    const routePolicy = resolveApiRouteContractPolicy(normalizedPath);

    if (
      SAFE_RUNTIME_PRESSURE_PATHS.has(normalizedPath) ||
      routePolicy.runtime.shedOnCpuPressure !== true
    ) {
      next();
      return;
    }

    const snapshot = this.runtimePressureService.getSnapshot();
    if (!snapshot.overloaded) {
      next();
      return;
    }

    this.operationalObservabilityService.record({
      type: 'runtime_pressure',
      route: normalizedPath,
      request: req as unknown as Record<string, any>,
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      severity: 'warn',
      detail: `shed route=${routePolicy.id} cause=${snapshot.cause} lagP99Ms=${snapshot.eventLoopLagP99Ms} elu=${snapshot.eventLoopUtilization} queue=${snapshot.queueDepth}`,
      extra: {
        routeId: routePolicy.id,
        cause: snapshot.cause,
        eventLoopLagP95Ms: snapshot.eventLoopLagP95Ms,
        eventLoopLagP99Ms: snapshot.eventLoopLagP99Ms,
        eventLoopLagMaxMs: snapshot.eventLoopLagMaxMs,
        eventLoopUtilization: snapshot.eventLoopUtilization,
        heapUsedRatio: snapshot.heapUsedRatio,
        recentApiLatencyMs: snapshot.recentApiLatencyMs,
        gcPauseP95Ms: snapshot.gcPauseP95Ms,
        gcPauseMaxMs: snapshot.gcPauseMaxMs,
        gcEventsRecent: snapshot.gcEventsRecent,
        queueDepth: snapshot.queueDepth,
        activeIsolatedRequests: snapshot.activeIsolatedRequests,
        pressureScore: snapshot.pressureScore,
        adaptiveThrottleFactor: snapshot.adaptiveThrottleFactor,
      },
    });
    annotateRequestTrace(req as unknown as Record<string, any>, {
      mitigationFlags: ['feature_degraded'],
    });

    res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      error: 'Service Unavailable',
      code: 'RUNTIME_PRESSURE',
      message:
        'O backend esta sob alta pressao de CPU/event loop e recusou esta rota para evitar falha em cascata.',
      routeId: routePolicy.id,
      cause: snapshot.cause,
      eventLoopLagP99Ms: snapshot.eventLoopLagP99Ms,
      eventLoopUtilization: snapshot.eventLoopUtilization,
      queueDepth: snapshot.queueDepth,
      recentApiLatencyMs: snapshot.recentApiLatencyMs,
      adaptiveThrottleFactor: snapshot.adaptiveThrottleFactor,
    });
  }
}
