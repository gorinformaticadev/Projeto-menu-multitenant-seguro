import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  Response as NestResponse,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { Roles } from '@core/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { OpsRuntimeTestService } from './ops-runtime-test.service';

@Controller('ops-runtime-test')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class OpsRuntimeTestController {
  constructor(private readonly opsRuntimeTestService: OpsRuntimeTestService) {}

  @Get('cluster/health')
  async clusterHealth(@Request() request: Record<string, any>) {
    return this.opsRuntimeTestService.getClusterHealth(request);
  }

  @Post('fair-queue/hold')
  async fairQueueHold(
    @Request() request: Record<string, any>,
    @Body('holdMs') holdMs?: number,
  ) {
    return this.opsRuntimeTestService.holdFairQueue(request, holdMs || 0);
  }

  @Get('runtime/slow')
  async slowSuccess(
    @Request() request: Record<string, any>,
    @Query('delayMs') delayMs?: string,
  ) {
    return this.opsRuntimeTestService.slowSuccess(request, Number.parseInt(delayMs || '', 10));
  }

  @Get('rate-limit/ping')
  ping(@Request() request: Record<string, any>) {
    return {
      ok: true,
      instanceId: process.env.NODE_APP_INSTANCE || process.env.HOSTNAME || `instance-${process.pid}`,
      tenantId: String(request?.user?.tenantId || '').trim().toLowerCase() || null,
      userId: String(request?.user?.id || request?.user?.sub || '').trim().toLowerCase() || null,
      adaptiveFactor: request?.__rateLimitContext?.adaptiveFactor ?? 1,
      pressureCause: request?.__rateLimitContext?.pressureCause ?? null,
      routePolicyId: request?.__rateLimitContext?.routePolicyId ?? 'ops-runtime-test-rate-limit',
      at: new Date().toISOString(),
    };
  }

  @Get('shedding/context')
  async sheddingContext(
    @Request() request: Record<string, any>,
    @Query('path') path?: string,
  ) {
    return this.opsRuntimeTestService.getAdaptiveContext(request, path);
  }

  @Get('alerts/evaluate')
  @Roles(Role.SUPER_ADMIN)
  async evaluateAlerts() {
    return this.opsRuntimeTestService.evaluateAlerts();
  }

  @Get('dependency/check')
  async dependencyCheck(
    @Request() request: Record<string, any>,
    @NestResponse({ passthrough: true }) response: Response,
    @Query('timeoutMs') timeoutMs?: string,
  ) {
    const result = await this.opsRuntimeTestService.checkDependency(
      request,
      Number.parseInt(timeoutMs || '', 10),
    );
    response.status(result.statusCode);
    return result;
  }
}
