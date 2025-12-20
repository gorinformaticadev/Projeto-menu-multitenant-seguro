import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { CspReportController } from './controllers/csp-report.controller';
import { CspMiddleware } from './middleware/csp.middleware';
import { StaticCorsMiddleware } from './middleware/static-cors.middleware';
import { PlatformInitService } from './services/platform-init.service';
import { SecurityConfigModule } from '@core/security-config/security-config.module';
import { UserModulesController } from './user-modules.controller';
import { ModuleSecurityService } from './module-security.service';
import { NotificationService } from './notification.service';
import { eventBus } from './events/EventBus';
import { NotificationModule } from './notifications/notification.module';

@Module({
  imports: [SecurityConfigModule, NotificationModule],
  controllers: [CspReportController, UserModulesController],
  providers: [
    PlatformInitService,
    ModuleSecurityService,
    NotificationService,
    {
      provide: 'EventBus',
      useValue: eventBus
    }
  ],
  exports: [PlatformInitService, ModuleSecurityService, NotificationService],
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
