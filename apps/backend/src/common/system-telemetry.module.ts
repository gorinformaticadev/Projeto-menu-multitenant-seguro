import { Global, Module } from '@nestjs/common';
import { SystemTelemetryService } from './services/system-telemetry.service';

@Global()
@Module({
  providers: [SystemTelemetryService],
  exports: [SystemTelemetryService],
})
export class SystemTelemetryModule {}
