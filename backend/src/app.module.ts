import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { TenantInterceptor } from './common/interceptors/tenant.interceptor';
import { UsersModule } from './users/users.module';
import { SecurityConfigModule } from './security-config/security-config.module';
import { AuditModule } from './audit/audit.module';
import { ValidatorsModule } from './common/validators/validators.module';
import { HttpsRedirectMiddleware } from './common/middleware/https-redirect.middleware';
import { SentryModule } from './common/services/sentry.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SentryModule,
    CommonModule,
    // ============================================
    // 🛡️ RATE LIMITING - Proteção contra Brute Force
    // ============================================
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 60 segundos (1 minuto)
        limit: 1000, // 1000 requisições por minuto (aumentado para evitar bloqueios)
      },
      {
        name: 'login',
        ttl: 60000, // 60 segundos
        limit: 5, // 5 tentativas de login por minuto
      },
    ]),
    PrismaModule,
    ValidatorsModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    SecurityConfigModule,
    AuditModule,
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
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // HTTPS Redirect - Apenas em produção
    consumer.apply(HttpsRedirectMiddleware).forRoutes('*');
  }
}
