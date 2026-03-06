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
import { NotificationService } from '../../src/notifications/notification.service';
import { SystemNotificationsController } from '../../src/notifications/system-notifications.controller';
import { NotificationsSseJwtGuard } from '../../src/notifications/guards/notifications-sse-jwt.guard';

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

const SYSTEM_NOTIFICATIONS_FIXTURE = {
  notifications: [
    {
      id: 'notif-1',
      type: 'SYSTEM_ALERT',
      severity: 'critical',
      title: 'Update falhou',
      body: 'Falha no update da versao v1.2.3',
      data: { action: 'UPDATE_FAILED' },
      createdAt: new Date('2026-03-05T22:00:00Z'),
      isRead: false,
      readAt: null,
    },
  ],
  total: 1,
  unreadCount: 1,
  page: 1,
  limit: 20,
  hasMore: false,
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

const notificationServiceMock = {
  listSystemNotifications: jest.fn(async () => ({ ...SYSTEM_NOTIFICATIONS_FIXTURE })),
  markSystemNotificationAsRead: jest.fn(async (id: string) => ({
    ...SYSTEM_NOTIFICATIONS_FIXTURE.notifications[0],
    id,
    isRead: true,
    readAt: new Date('2026-03-05T22:05:00Z'),
  })),
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
    SystemNotificationsController,
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
    {
      provide: NotificationService,
      useValue: notificationServiceMock,
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
      .overrideGuard(NotificationsSseJwtGuard)
      .useValue({ canActivate: () => true })
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
    notificationServiceMock.listSystemNotifications.mockClear();
    notificationServiceMock.listSystemNotifications.mockResolvedValue({
      ...SYSTEM_NOTIFICATIONS_FIXTURE,
    });
    notificationServiceMock.markSystemNotificationAsRead.mockClear();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
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

  it('GET /api/system/notifications enforces auth and returns super-admin payload', async () => {
    await request(app.getHttpServer()).get('/api/system/notifications').expect(401);

    const response = await request(app.getHttpServer())
      .get('/api/system/notifications')
      .set('Authorization', 'Bearer smoke-admin-token')
      .expect(200);

    expect(response.body.notifications).toHaveLength(1);
    expect(response.body.unreadCount).toBe(1);
    expect(response.body.notifications[0].severity).toBe('critical');
    expect(notificationServiceMock.listSystemNotifications).toHaveBeenCalledTimes(1);
  });

  it('POST /api/system/notifications/:id/read marks notification as read', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/system/notifications/notif-1/read')
      .set('Authorization', 'Bearer smoke-admin-token')
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.notification.id).toBe('notif-1');
    expect(response.body.notification.isRead).toBe(true);
    expect(notificationServiceMock.markSystemNotificationAsRead).toHaveBeenCalledWith('notif-1');
  });

  it('maintenance guard returns 503 for regular routes and still allows health, update status and notifications', async () => {
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

    await request(app.getHttpServer())
      .get('/api/system/notifications')
      .set('Authorization', 'Bearer smoke-admin-token')
      .expect(200);
  });
});
