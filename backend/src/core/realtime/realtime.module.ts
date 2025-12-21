/**
 * REALTIME MODULE - Módulo de comunicação em tempo real
 */

import { Module, Global } from '@nestjs/common';
import { RealtimeBus } from './realtime.bus';
import { RealtimeScheduler } from './realtime.scheduler';

@Global()
@Module({
  providers: [RealtimeBus, RealtimeScheduler],
  exports: [RealtimeBus],
})
export class RealtimeModule {}