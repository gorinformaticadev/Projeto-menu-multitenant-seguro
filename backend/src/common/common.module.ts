import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { CspReportController } from './controllers/csp-report.controller';
import { CspMiddleware } from './middleware/csp.middleware';

@Module({
  controllers: [CspReportController],
  providers: [],
  exports: [],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Aplicar CSP middleware apenas se CSP_ADVANCED estiver ativado
    if (process.env.CSP_ADVANCED === 'true') {
      consumer.apply(CspMiddleware).forRoutes('*');
    }
  }
}

