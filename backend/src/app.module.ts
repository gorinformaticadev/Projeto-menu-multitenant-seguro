import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // ============================================
    // 🛡️ RATE LIMITING - Proteção contra Brute Force
    // ============================================
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60000, // 60 segundos (1 minuto)
        limit: 100, // 100 requisições por minuto
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
export class AppModule {}
