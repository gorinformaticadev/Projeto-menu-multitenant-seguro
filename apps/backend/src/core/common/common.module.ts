import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { CspReportController } from './controllers/csp-report.controller';
import { CspMiddleware } from './middleware/csp.middleware';
import { PlatformInitService } from './services/platform-init.service';
import { SecurityConfigModule } from '@core/security-config/security-config.module';

@Module({
  imports: [SecurityConfigModule],
  controllers: [CspReportController],
  providers: [PlatformInitService],
  exports: [PlatformInitService],
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
