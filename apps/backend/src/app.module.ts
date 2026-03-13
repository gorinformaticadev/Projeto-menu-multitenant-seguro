import { Module, NestModule, MiddlewareConsumer, DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from "@nestjs/throttler";
import { SecurityThrottlerGuard } from "./common/guards/security-throttler.guard";
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from './core/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { TenantInterceptor } from './common/interceptors/tenant.interceptor';
import { RequestContextInterceptor } from './common/interceptors/request-context.interceptor';
import { UsersModule } from './users/users.module';
import { SecurityConfigModule } from '@core/security-config/security-config.module';
import { EmailConfigModule } from '@core/security-config/email-config.module';
import { AuditModule } from './audit/audit.module';
import { ValidatorsModule } from './common/validators/validators.module';
import { HttpsRedirectMiddleware } from './common/middleware/https-redirect.middleware';
import { SentryModule } from './common/services/sentry.module';
import { CommonModule } from './common/common.module';
import { SystemTelemetryModule } from './common/system-telemetry.module';
import { UpdateModule } from './update/update.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SecureFilesModule } from './core/secure-files/secure-files.module';
import { DynamicModulesLoader } from './core/dynamic-modules.loader';
import { PrismaService } from './core/prisma/prisma.service';
import { WhatsAppModule } from './core/whatsapp/whatsapp.module';
import { CronModule } from './core/cron/cron.module';
import { BackupModule } from './backup/backup.module';
import { HealthModule } from './health/health.module';
import { RedisThrottlerStorage } from './common/services/redis-throttler.storage';
import { PathsModule } from './core/common/paths/paths.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { MaintenanceModeGuard } from './maintenance/maintenance-mode.guard';
import { SystemDataRetentionModule } from './retention/system-data-retention.module';
import { ResponseTimeMetricsInterceptor } from './dashboard/system-response-time-metrics.interceptor';
import { SystemTelemetryInterceptor } from './common/interceptors/system-telemetry.interceptor';
import { SystemDashboardModule } from './dashboard/system-dashboard.module';
import { SystemDiagnosticsModule } from './diagnostics/system-diagnostics.module';
import { SystemSettingsModule } from './system-settings/system-settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SystemSettingsModule,
    // Modulo de agendamento para tarefas cron
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    PathsModule,
    SentryModule,
    CommonModule,
    SystemTelemetryModule,
    // ============================================
    // Rate limiting global com segmentacao por contexto no guard
    // ============================================
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        storage: new RedisThrottlerStorage({
          enabled: configService.get('RATE_LIMIT_REDIS_ENABLED', 'true') !== 'false',
          host: configService.get('REDIS_HOST', '127.0.0.1'),
          port: Number(configService.get('REDIS_PORT', 6379)),
          username: configService.get('REDIS_USERNAME'),
          password: configService.get('REDIS_PASSWORD'),
          db: Number(configService.get('REDIS_DB', 0)),
          keyPrefix: configService.get('RATE_LIMIT_REDIS_PREFIX', 'rate-limit'),
          connectTimeout: Number(configService.get('RATE_LIMIT_REDIS_CONNECT_TIMEOUT', 1000)),
        }),
        throttlers: [
          {
            name: 'default',
            ttl: 60000, // 60 segundos (1 minuto)
            // O guard ajusta por IP, usuario, tenant, risco operacional e alto volume.
            limit: 300,
          },
        ],
      }),
    }),
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
    SystemDashboardModule,
    SystemDiagnosticsModule,
    SystemDataRetentionModule,
    WhatsAppModule,
    SecureFilesModule, // Modulo de uploads sensiveis
    MaintenanceModule,
    CronModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestContextInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SystemTelemetryInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseTimeMetricsInterceptor,
    },
    // Maintenance Mode Global
    {
      provide: APP_GUARD,
      useExisting: MaintenanceModeGuard,
    },
    // Rate Limiting Global
    {
      provide: APP_GUARD,
      useClass: SecurityThrottlerGuard,
    },
    // CSRF Protection Global (TEMPORARIAMENTE DESABILITADO PARA RESOLVER 403 EM PRODUÃƒÂ¯Ã‚Â¿Ã‚Â½ÃƒÂ¯Ã‚Â¿Ã‚Â½O)
    // Sem cookie autenticado, CSRF nao se aplica aos fluxos atuais.
    // Se algum login por cookie/sessao for adicionado, esta guarda deve ser reativada.
    // {
    //   provide: APP_GUARD,
    //   useClass: CsrfGuard,
    // },
  ],
})
export class AppModule implements NestModule {
  static async register(): Promise<DynamicModule> {
    const prisma = new PrismaService();
    // Conecta explicitamente para garantir que o banco estÃƒÂ¯Ã‚Â¿Ã‚Â½ acessÃƒÂ¯Ã‚Â¿Ã‚Â½vel
    // (Opcional, pois o Prisma conecta ao fazer a query, mas boa prÃƒÂ¯Ã‚Â¿Ã‚Â½tica para debug)

    const dynamicModules = await DynamicModulesLoader.load(prisma);

    // Desconecta apÃƒÂ¯Ã‚Â¿Ã‚Â½s carregar (cada mÃƒÂ¯Ã‚Â¿Ã‚Â½dulo terÃƒÂ¯Ã‚Â¿Ã‚Â½ seu prÃƒÂ¯Ã‚Â¿Ã‚Â½prio PrismaService via injeÃƒÂ¯Ã‚Â¿Ã‚Â½ÃƒÂ¯Ã‚Â¿Ã‚Â½o se necessÃƒÂ¯Ã‚Â¿Ã‚Â½rio,
    // ou usarÃƒÂ¯Ã‚Â¿Ã‚Â½o o PrismaModule global)
    await prisma.$disconnect();

    return {
      module: AppModule,
      imports: [...dynamicModules],
    };
  }

  configure(consumer: MiddlewareConsumer) {
    // HTTPS Redirect - Apenas em produÃƒÂ¯Ã‚Â¿Ã‚Â½ÃƒÂ¯Ã‚Â¿Ã‚Â½o
    consumer.apply(HttpsRedirectMiddleware).forRoutes('*');
  }
}

// Forced restart trigger



