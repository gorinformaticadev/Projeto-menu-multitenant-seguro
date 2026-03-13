import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@core/prisma/prisma.module';
import { SystemTelemetryModule } from '@common/system-telemetry.module';
import { ConfigResolverService } from './config-resolver.service';
import { SettingsRegistry } from './settings-registry.service';
import { SystemSettingsBootstrapService } from './system-settings-bootstrap.service';
import { SystemSettingsReadService } from './system-settings-read.service';
import { SystemSettingsController } from './system-settings.controller';

@Global()
@Module({
  imports: [ConfigModule, PrismaModule, SystemTelemetryModule],
  controllers: [SystemSettingsController],
  providers: [
    SettingsRegistry,
    ConfigResolverService,
    SystemSettingsBootstrapService,
    SystemSettingsReadService,
  ],
  exports: [
    SettingsRegistry,
    ConfigResolverService,
    SystemSettingsBootstrapService,
    SystemSettingsReadService,
  ],
})
export class SystemSettingsModule {}
