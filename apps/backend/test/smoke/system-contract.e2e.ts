import {
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  INestApplication,
  Injectable,
  Module,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import request = require('supertest');
import { HealthController } from '../../src/health/health.controller';
import {
  MaintenanceModeService,
  MaintenanceState,
} from '../../src/maintenance/maintenance-mode.service';
import { MaintenanceModeGuard } from '../../src/maintenance/maintenance-mode.guard';
import { MaintenanceController } from '../../src/maintenance/maintenance.controller';
import { RolesGuard } from '../../src/core/common/guards/roles.guard';
import { JwtAuthGuard } from '../../src/core/common/guards/jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../../src/core/decorators/public.decorator';
import { SystemUpdateController } from '../../src/update/system-update.controller';
import { SystemUpdateAdminService } from '../../src/update/system-update-admin.service';

const DEFAULT_MAINTENANCE_STATE: MaintenanceState = {
  enabled: false,
  reason: null,
  startedAt: null,
  etaSeconds: null,
  allowedRoles: ['SUPER_ADMIN'],
  bypassHeader: 'X-Maintenance-Bypass',
};

const UPDATE_STATUS_RESPONSE = {
  status: 'idle',
  startedAt: null,
  finishedAt: null,
  fromVersion: 'v1.0.0',
  toVersion: 'v1.0.1',
  step: 'idle',
  progress: 0,
  lock: false,
  lastError: null,
  rollback: {
    attempted: false,
    completed: false,
    reason: null,
  },
  operation: {
    active: false,
    operationId: null,
    type: null,
  },
  stale: false,
  lockPath: '/tmp/update.lock',
  statePath: '/tmp/update-state.json',
};

let maintenanceState = { ...DEFAULT_MAINTENANCE_STATE };

const maintenanceModeServiceMock = {
  getState: jest.fn(async () => maintenanceState),
};

const systemUpdateAdminServiceMock = {
  getStatus: jest.fn(async () => UPDATE_STATUS_RESPONSE),
  getLogTail: jest.fn(),
  listReleases: jest.fn(),
  runUpdate: jest.fn(),
  runRollback: jest.fn(),
};

@Injectable()
class MockJwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const authorization = String(req.headers.authorization || '');

    if (authorization === 'Bearer smoke-admin-token') {
      req.user = {
        id: 'smoke-admin',
        sub: 'smoke-admin',
        role: Role.SUPER_ADMIN,
      };
      return true;
    }

    throw new UnauthorizedException('Token invalido ou expirado');
  }
}

@Controller('tenants')
class DummyTenantsController {
  @Get()
  list() {
    return { data: [] };
  }
}

@Module({
  controllers: [
    DummyTenantsController,
    HealthController,
    MaintenanceController,
    SystemUpdateController,
  ],
  providers: [
    Reflector,
    RolesGuard,
    MaintenanceModeGuard,
    {
      provide: APP_GUARD,
      useExisting: MaintenanceModeGuard,
    },
    {
      provide: MaintenanceModeService,
      useValue: maintenanceModeServiceMock,
    },
    {
      provide: SystemUpdateAdminService,
      useValue: systemUpdateAdminServiceMock,
    },
  ],
})
class SmokeContractTestModule {}

describe('System contract smoke', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SmokeContractTestModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockJwtAuthGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  beforeEach(() => {
    maintenanceState = { ...DEFAULT_MAINTENANCE_STATE };
    maintenanceModeServiceMock.getState.mockClear();
    systemUpdateAdminServiceMock.getStatus.mockClear();
    systemUpdateAdminServiceMock.getStatus.mockResolvedValue({
      ...UPDATE_STATUS_RESPONSE,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns 200', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200, { status: 'ok' });
  });

  it('GET /api/system/maintenance/state returns a sanitized state payload', async () => {
    maintenanceState = {
      enabled: true,
      reason: 'planned maintenance',
      startedAt: '2026-03-05T22:00:00Z',
      etaSeconds: 300,
      allowedRoles: ['SUPER_ADMIN'],
      bypassHeader: 'X-Maintenance-Bypass',
    };

    const response = await request(app.getHttpServer())
      .get('/api/system/maintenance/state')
      .expect(200);

    expect(response.body).toEqual({
      enabled: true,
      reason: 'planned maintenance',
      startedAt: '2026-03-05T22:00:00Z',
      etaSeconds: 300,
    });
    expect(response.body.allowedRoles).toBeUndefined();
    expect(response.body.bypassHeader).toBeUndefined();
  });

  it('GET /api/system/update/status enforces auth and returns 200 for mocked admin auth', async () => {
    await request(app.getHttpServer()).get('/api/system/update/status').expect(401);

    const response = await request(app.getHttpServer())
      .get('/api/system/update/status')
      .set('Authorization', 'Bearer smoke-admin-token')
      .expect(200);

    expect(response.body.status).toBe('idle');
    expect(response.body.operation).toEqual({
      active: false,
      operationId: null,
      type: null,
    });
    expect(systemUpdateAdminServiceMock.getStatus).toHaveBeenCalledTimes(1);
  });

  it('maintenance guard returns 503 for regular routes and still allows health and update status', async () => {
    maintenanceState = {
      enabled: true,
      reason: 'upgrade in progress',
      startedAt: '2026-03-05T22:00:00Z',
      etaSeconds: 180,
      allowedRoles: ['SUPER_ADMIN'],
      bypassHeader: 'X-Maintenance-Bypass',
    };

    const blocked = await request(app.getHttpServer()).get('/api/tenants').expect(503);
    expect(blocked.body.error).toBe('MAINTENANCE_MODE');
    expect(blocked.body.reason).toBe('upgrade in progress');
    expect(blocked.body.etaSeconds).toBe(180);

    await request(app.getHttpServer()).get('/api/health').expect(200, { status: 'ok' });

    await request(app.getHttpServer())
      .get('/api/system/update/status')
      .set('Authorization', 'Bearer smoke-admin-token')
      .expect(200);
  });
});