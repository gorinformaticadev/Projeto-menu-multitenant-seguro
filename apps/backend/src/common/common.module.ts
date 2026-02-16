import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { CspReportController } from './controllers/csp-report.controller';
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

@Module({
  imports: [PrismaModule, SecurityConfigModule, NotificationsModule, AuditModule],
  controllers: [CspReportController, UserModulesController, ModuleInstallerController],
  providers: [
    PlatformInitService,
    ModuleSecurityService,
    ModuleInstallerService,
    ModuleDatabaseExecutorService,
    {
      provide: 'EventBus',
      useValue: eventBus
    }
  ],
  exports: [
    PlatformInitService,
    ModuleSecurityService,
    ModuleInstallerService,
    ModuleDatabaseExecutorService,
    PrismaModule  // Export PrismaModule for module dependencies
  ],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // CORS para arquivos estáticos está configurado em main.ts (useStaticAssets)
    // Middleware removido para permitir acesso público aos logos
    // StaticCorsMiddleware bloqueava requisições sem header 'origin'

    // Aplicar CSP middleware apenas se CSP_ADVANCED estiver ativado
    if (process.env.CSP_ADVANCED === 'true') {
      consumer.apply(CspMiddleware).forRoutes('*');
    }
  }
}

