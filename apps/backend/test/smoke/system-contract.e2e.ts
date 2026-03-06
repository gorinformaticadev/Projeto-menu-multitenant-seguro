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
import { JwtService } from '@nestjs/jwt';
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
import { AuditService } from '../../src/audit/audit.service';
import { SystemAuditController } from '../../src/audit/system-audit.controller';
import { SystemDataRetentionController } from '../../src/retention/system-data-retention.controller';
import { SystemDataRetentionService } from '../../src/retention/system-data-retention.service';
import { SystemDashboardController } from '../../src/dashboard/system-dashboard.controller';
import { SystemDashboardService } from '../../src/dashboard/system-dashboard.service';

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
  list: jest.fn(async () => ({ ...SYSTEM_NOTIFICATIONS_FIXTURE })),
  getUnreadCount: jest.fn(async () => SYSTEM_NOTIFICATIONS_FIXTURE.unreadCount),
  markSystemNotificationAsRead: jest.fn(async (id: string) => ({
    ...SYSTEM_NOTIFICATIONS_FIXTURE.notifications[0],
    id,
    isRead: true,
    readAt: new Date('2026-03-05T22:05:00Z'),
  })),
  markAllSystemNotificationsAsRead: jest.fn(async () => SYSTEM_NOTIFICATIONS_FIXTURE.unreadCount),
};

const auditServiceMock = {
  findAll: jest.fn(async () => ({
    data: [
      {
        id: 'audit-1',
        action: 'UPDATE_STARTED',
        severity: 'warning',
        message: 'Update iniciado',
        actorUserId: 'smoke-admin',
        metadata: { source: 'panel' },
        createdAt: new Date('2026-03-06T10:00:00Z'),
      },
    ],
    meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
  })),
  findOne: jest.fn(async (id: string) => ({
    id,
    action: 'UPDATE_STARTED',
    severity: 'warning',
    message: 'Update iniciado',
    actorUserId: 'smoke-admin',
    metadata: { source: 'panel' },
    createdAt: new Date('2026-03-06T10:00:00Z'),
  })),
  log: jest.fn(async () => null),
};

const retentionServiceMock = {
  runRetentionCleanup: jest.fn(async () => ({
    deletedAuditLogs: 8,
    deletedNotifications: 3,
    auditCutoff: new Date('2025-09-08T03:30:00Z'),
    notificationCutoff: new Date('2026-02-06T03:30:00Z'),
    auditRetentionDays: 180,
    notificationRetentionDays: 30,
    errors: [],
  })),
};

const systemDashboardServiceMock = {
  getDashboard: jest.fn(async () => ({
    generatedAt: '2026-03-06T14:00:00.000Z',
    version: { status: 'ok', version: 'v1.2.3' },
    uptime: { status: 'ok', human: '01:22:33' },
    maintenance: { status: 'ok', enabled: false },
    api: { status: 'ok', avgResponseTimeMs: 45.3, sampleSize: 12 },
    notifications: { status: 'ok', criticalUnread: 1, criticalRecent: 2 },
    widgets: { available: ['version', 'uptime', 'maintenance', 'api', 'notifications'] },
  })),
  getLayout: jest.fn(async () => ({
    role: Role.SUPER_ADMIN,
    layoutJson: { lg: [] },
    filtersJson: { periodMinutes: 60, severity: 'all', hiddenWidgetIds: [] },
    updatedAt: '2026-03-06T14:01:00.000Z',
  })),
  saveLayout: jest.fn(async () => ({
    role: Role.SUPER_ADMIN,
    layoutJson: { lg: [] },
    filtersJson: { periodMinutes: 60, severity: 'all', hiddenWidgetIds: [] },
    updatedAt: '2026-03-06T14:02:00.000Z',
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

    if (authorization === 'Bearer smoke-user-token') {
      req.user = {
        id: 'smoke-user',
        sub: 'smoke-user',
        role: Role.USER,
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
    SystemAuditController,
    SystemDataRetentionController,
    SystemDashboardController,
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
    {
      provide: AuditService,
      useValue: auditServiceMock,
    },
    {
      provide: SystemDataRetentionService,
      useValue: retentionServiceMock,
    },
    {
      provide: SystemDashboardService,
      useValue: systemDashboardServiceMock,
    },
    {
      provide: JwtService,
      useValue: {
        verify: jest.fn((token: string) => {
          if (token === 'smoke-user-token') {
            return { role: Role.USER, sub: 'smoke-user' };
          }
          return { role: Role.SUPER_ADMIN, sub: 'smoke-admin' };
        }),
      },
    },
  ],
})
class SmokeContractTestModule {}

describe('System contract smoke', () => {
  let app: INestApplication;
  let previousJwtSecret: string | undefined;

  beforeAll(async () => {
    previousJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'smoke-secret';

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
    notificationServiceMock.list.mockClear();
    notificationServiceMock.list.mockResolvedValue({
      ...SYSTEM_NOTIFICATIONS_FIXTURE,
    });
    notificationServiceMock.getUnreadCount.mockClear();
    notificationServiceMock.markSystemNotificationAsRead.mockClear();
    notificationServiceMock.markAllSystemNotificationsAsRead.mockClear();
    auditServiceMock.findAll.mockClear();
    auditServiceMock.findOne.mockClear();
    auditServiceMock.log.mockClear();
    retentionServiceMock.runRetentionCleanup.mockClear();
    systemDashboardServiceMock.getDashboard.mockClear();
    systemDashboardServiceMock.getLayout.mockClear();
    systemDashboardServiceMock.saveLayout.mockClear();
  });

  afterAll(async () => {
    if (previousJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousJwtSecret;
    }

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
    expect(notificationServiceMock.list).toHaveBeenCalledTimes(1);
  });

  it('GET /api/system/notifications/unread-count returns unread count', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/system/notifications/unread-count')
      .set('Authorization', 'Bearer smoke-admin-token')
      .expect(200);

    expect(response.body).toEqual({ count: 1 });
    expect(notificationServiceMock.getUnreadCount).toHaveBeenCalledWith({
      targetRole: 'SUPER_ADMIN',
    });
  });

  it('POST /api/system/notifications/:id/read marks notification as read', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/system/notifications/notif-1/read')
      .set('Authorization', 'Bearer smoke-admin-token')
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.notification.id).toBe('notif-1');
    expect(response.body.notification.isRead).toBe(true);
    expect(notificationServiceMock.markSystemNotificationAsRead).toHaveBeenCalledWith(
      'notif-1',
      expect.objectContaining({
        role: Role.SUPER_ADMIN,
        targetRole: 'SUPER_ADMIN',
      }),
    );
  });

  it('POST /api/system/notifications/read-all marks all notifications as read', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/system/notifications/read-all')
      .set('Authorization', 'Bearer smoke-admin-token')
      .expect(201);

    expect(response.body).toEqual({ success: true, count: 1 });
    expect(notificationServiceMock.markAllSystemNotificationsAsRead).toHaveBeenCalledWith(
      expect.objectContaining({
        role: Role.SUPER_ADMIN,
        targetRole: 'SUPER_ADMIN',
      }),
    );
  });

  it('GET /api/system/audit enforces auth and returns audit payload for admin', async () => {
    await request(app.getHttpServer()).get('/api/system/audit').expect(401);

    const response = await request(app.getHttpServer())
      .get('/api/system/audit')
      .set('Authorization', 'Bearer smoke-admin-token')
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].action).toBe('UPDATE_STARTED');
    expect(auditServiceMock.findAll).toHaveBeenCalledTimes(1);
  });

  it('POST /api/system/retention/run executes manual retention for SUPER_ADMIN', async () => {
    await request(app.getHttpServer()).post('/api/system/retention/run').expect(401);

    const response = await request(app.getHttpServer())
      .post('/api/system/retention/run')
      .set('Authorization', 'Bearer smoke-admin-token')
      .expect(201);

    expect(response.body).toEqual({
      deletedAuditLogs: 8,
      deletedNotifications: 3,
      auditCutoff: '2025-09-08T03:30:00.000Z',
      notificationCutoff: '2026-02-06T03:30:00.000Z',
    });
    expect(retentionServiceMock.runRetentionCleanup).toHaveBeenCalledWith('manual');
  });

  it('GET /api/system/dashboard returns aggregated payload for authenticated user', async () => {
    await request(app.getHttpServer()).get('/api/system/dashboard').expect(401);

    const response = await request(app.getHttpServer())
      .get('/api/system/dashboard')
      .set('Authorization', 'Bearer smoke-admin-token')
      .expect(200);

    expect(response.body.version.version).toBe('v1.2.3');
    expect(response.body.widgets.available).toContain('notifications');
    expect(systemDashboardServiceMock.getDashboard).toHaveBeenCalledTimes(1);
  });

  it('GET/PUT /api/system/dashboard/layout loads and persists layout', async () => {
    const getResponse = await request(app.getHttpServer())
      .get('/api/system/dashboard/layout')
      .set('Authorization', 'Bearer smoke-admin-token')
      .expect(200);

    expect(getResponse.body.role).toBe(Role.SUPER_ADMIN);
    expect(systemDashboardServiceMock.getLayout).toHaveBeenCalledTimes(1);

    await request(app.getHttpServer())
      .put('/api/system/dashboard/layout')
      .set('Authorization', 'Bearer smoke-admin-token')
      .send({
        layoutJson: { lg: [{ i: 'version', x: 0, y: 0, w: 1, h: 1 }] },
        filtersJson: { periodMinutes: 30, severity: 'critical', hiddenWidgetIds: ['maintenance'] },
      })
      .expect(200);

    expect(systemDashboardServiceMock.saveLayout).toHaveBeenCalledTimes(1);
  });

  it('maintenance guard returns 503 for regular routes and allows dashboard only for admin roles', async () => {
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

    await request(app.getHttpServer())
      .get('/api/system/dashboard')
      .set('Authorization', 'Bearer smoke-admin-token')
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/system/dashboard')
      .set('Authorization', 'Bearer smoke-user-token')
      .expect(503);
  });
});
