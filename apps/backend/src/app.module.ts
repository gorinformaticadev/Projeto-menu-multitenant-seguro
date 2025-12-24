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
import { SecureFilesModule } from './core/secure-files/secure-files.module';
import { AppModulesModule } from './core/modules/AppModules.module';
import { WhatsAppModule } from './core/whatsapp/whatsapp.module';
import { CronModule } from './core/cron/cron.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Módulo de agendamento para tarefas cron
    ScheduleModule.forRoot(),
    SentryModule,
    CommonModule,
    // ============================================
    // 🛡️  RATE LIMITING - Proteção contra Brute Force
    // Configurações ajustadas por ambiente
    // ============================================
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 60 segundos (1 minuto)
        // Desenvolvimento: 10000 req/min (AUMENTADO DEBUG)
        limit: 10000,
      },
      {
        name: 'login',
        ttl: 60000, // 60 segundos
        // Desenvolvimento: 10 tentativas | Produção: 5 tentativas
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
    NotificationsModule, // Novo sistema Socket.IO apenas
    WhatsAppModule,
    SecureFilesModule, // Módulo de uploads sensíveis
    AppModulesModule.forRoot(), // Módulo de carregamento dinâmico de módulos externos
    CronModule,
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
    // Serviço de limpeza de tokens
    TokenCleanupService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // HTTPS Redirect - Apenas em produção
    consumer.apply(HttpsRedirectMiddleware).forRoutes('*');
  }
}
