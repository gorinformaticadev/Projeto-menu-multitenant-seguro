import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { SystemDashboardService } from './src/dashboard/system-dashboard.service';
import { SystemDiagnosticsService } from './src/diagnostics/system-diagnostics.service';
import { NotificationService } from './src/notifications/notification.service';
import { AuditService } from './src/audit/audit.service';
import { UpdateService } from './src/update/update.service';

async function bootstrap() {
  console.log('--- STARTING RUNTIME VALIDATION ---');
  const app = await NestFactory.createApplicationContext(AppModule);

  const dashboardService = app.get(SystemDashboardService);
  const diagnosticsService = app.get(SystemDiagnosticsService);
  const notificationService = app.get(NotificationService);
  const auditService = app.get(AuditService);
  const updateService = app.get(UpdateService);

  const mockActor = {
    userId: 'mock-user-id',
    role: 'SUPER_ADMIN' as any,
    tenantId: null,
  };

  try {
    console.log('1. Validando Dashboard (HTTP vs Service Runtime)...');
    const dashboard = await dashboardService.getDashboard(mockActor, { periodMinutes: 60 });
    console.log('Dashboard Route Errors: ', JSON.stringify(dashboard.routeErrors?.topErrorRoutes?.slice(0, 1) || []), ' - Security: ', JSON.stringify(dashboard.security?.topDeniedIps?.slice(0, 1) || []));
    if (dashboard.security?.deniedAccess !== undefined && !Array.isArray(dashboard.security.deniedAccess)) {
      throw new Error('Divergencia em Dashboard: deniedAccess devia ser array');
    }

    console.log('2. Validando Diagnostics (Service Runtime)...');
    const diagnostics = await diagnosticsService.getSystemDiagnostics();
    console.log('Diagnostics Status: ', diagnostics.status);

    console.log('3. Validando Audit...');
    const audits = await auditService.getLogs({ limit: 1 });
    console.log('Audit format: ', audits.data?.[0]?.details ? 'has details' : 'no details');

    console.log('4. Validando Updates/Lifecycle...');
    const updateStatus = await updateService.getUpdateStatus();
    console.log('Update Status Check Enabled: ', updateStatus.checkEnabled);
    
    console.log('--- RUNTIME VALIDATION COMPLETED ---');
  } catch (error) {
    console.error('FAIL RUNTIME: ', error);
  } finally {
    await app.close();
  }
}

bootstrap();
