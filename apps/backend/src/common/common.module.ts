import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { CspReportController } from './controllers/csp-report.controller';
import { SystemVersionController } from './controllers/system-version.controller';
import { CspMiddleware } from './middleware/csp.middleware';
import { PlatformInitService } from './services/platform-init.service';
import { ModuleDatabaseExecutorService } from '../core/services/module-database-executor.service';
import { SecurityConfigModule } from '@core/security-config/security-config.module';
import { PrismaModule } from '@core/prisma/prisma.module';
import { UserModulesController } from '@core/user-modules.controller';
import { ModuleSecurityService } from '@core/module-security.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';
import { eventBus } from '@core/events/EventBus';
import { ModuleInstallerController } from '@core/module-installer.controller';
import { ModuleInstallerService } from '@core/module-installer.service';
import { SystemVersionService } from './services/system-version.service';
import { PathsModule } from '@core/common/paths/paths.module';
import { SystemOperationalAlertsService } from './services/system-operational-alerts.service';
import { SystemJobWatchdogService } from './services/system-job-watchdog.service';
import { CronModule } from '../core/cron/cron.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';

@Module({
  imports: [
    PrismaModule,
    SecurityConfigModule,
    NotificationsModule,
    AuditModule,
    PathsModule,
    CronModule,
    SystemSettingsModule,
  ],
  controllers: [CspReportController, SystemVersionController, UserModulesController, ModuleInstallerController],
  providers: [
    PlatformInitService,
    SystemVersionService,
    ModuleSecurityService,
    ModuleInstallerService,
    ModuleDatabaseExecutorService,
    SystemOperationalAlertsService,
    SystemJobWatchdogService,
    {
      provide: 'EventBus',
      useValue: eventBus
    }
  ],
  exports: [
    PlatformInitService,
    SystemVersionService,
    ModuleSecurityService,
    ModuleInstallerService,
    ModuleDatabaseExecutorService,
    SystemOperationalAlertsService,
    SystemJobWatchdogService,
    PrismaModule  // Export PrismaModule for module dependencies
  ],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // CORS para arquivos estáticos está configurado em main.ts (useStaticAssets)
    // Middleware removido para permitir acesso público aos logos
    // StaticCorsMiddleware bloqueava requisições sem header 'origin'

    // O middleware sempre participa do pipeline, mas decide dinamicamente
    // se deve sobrescrever o CSP basico com a politica avancada.
    consumer.apply(CspMiddleware).forRoutes('*');
  }
}
