import { Module, NestModule, MiddlewareConsumer, DynamicModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { CsrfGuard } from "./common/guards/csrf.guard";
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
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
import { SecureFilesModule } from './core/secure-files/secure-files.module';
import { DynamicModulesLoader } from './core/dynamic-modules.loader';
import { PrismaService } from './core/prisma/prisma.service';
import { WhatsAppModule } from './core/whatsapp/whatsapp.module';
import { CronModule } from './core/cron/cron.module';
import { BackupModule } from './backup/backup.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Módulo de agendamento para tarefas cron
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
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
    BackupModule,
    NotificationsModule, // Novo sistema Socket.IO apenas
    WhatsAppModule,
    SecureFilesModule, // Módulo de uploads sensíveis
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
    // CSRF Protection Global
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
    // Serviço de limpeza de tokens
    TokenCleanupService,
  ],
})
export class AppModule implements NestModule {
  static async register(): Promise<DynamicModule> {
    const prisma = new PrismaService();
    // Conecta explicitamente para garantir que o banco está acessível
    // (Opcional, pois o Prisma conecta ao fazer a query, mas boa prática para debug)

    const dynamicModules = await DynamicModulesLoader.load(prisma);

    // Desconecta após carregar (cada módulo terá seu próprio PrismaService via injeção se necessário,
    // ou usarão o PrismaModule global)
    await prisma.$disconnect();

    return {
      module: AppModule,
      imports: [...dynamicModules],
    };
  }

  configure(consumer: MiddlewareConsumer) {
    // HTTPS Redirect - Apenas em produção
    consumer.apply(HttpsRedirectMiddleware).forRoutes('*');
  }
}

// Forced restart trigger
