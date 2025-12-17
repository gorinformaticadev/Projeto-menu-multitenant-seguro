import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './core/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { TenantInterceptor } from './common/interceptors/tenant.interceptor';
import { UsersModule } from './users/users.module';
import { SecurityConfigModule } from './security-config/security-config.module';
import { EmailConfigModule } from './security-config/email-config.module';
import { AuditModule } from './audit/audit.module';
import { ValidatorsModule } from './common/validators/validators.module';
import { HttpsRedirectMiddleware } from './common/middleware/https-redirect.middleware';
import { SentryModule } from './common/services/sentry.module';
import { CommonModule } from './common/common.module';
import { TokenCleanupService } from './common/services/token-cleanup.service';
import { UpdateModule } from './update/update.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CoreModule } from './core/CoreModule';
// import { DemoModule } from '@core/modules/demo-completo/src/demo.module'; // Removed legacy import

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // MÃ³dulo de agendamento para tarefas cron
    ScheduleModule.forRoot(),
    SentryModule,
    CommonModule,
    // ============================================
    // ðŸ›¡ï¸ RATE LIMITING - ProteÃ§Ã£o contra Brute Force
    // ConfiguraÃ§Ãµes ajustadas por ambiente
    // ============================================
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 60 segundos (1 minuto)
        // Desenvolvimento: 2000 req/min | ProduÃ§Ã£o: 100 req/min
        limit: process.env.NODE_ENV === 'production' ? 100 : 2000,
      },
      {
        name: 'login',
        ttl: 60000, // 60 segundos
        // Desenvolvimento: 10 tentativas | ProduÃ§Ã£o: 5 tentativas
        limit: process.env.NODE_ENV === 'production' ? 5 : 10,
      },
    ]),
    PrismaModule,
    ValidatorsModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    SecurityConfigModule,
    EmailConfigModule,
    AuditModule,
    UpdateModule,
    NotificationsModule,

  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
    // Rate Limiting Global
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // ServiÃ§o de limpeza de tokens
    TokenCleanupService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // HTTPS Redirect - Apenas em produÃ§Ã£o
    consumer.apply(HttpsRedirectMiddleware).forRoutes('*');
  }
}
