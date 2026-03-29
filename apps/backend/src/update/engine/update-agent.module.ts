import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UpdateModule } from '../update.module';
import { UpdateAgentRunnerService } from './update-agent-runner.service';
import { UpdateExecutionLeaseService } from './update-execution-lease.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    UpdateModule,
  ],
  providers: [UpdateExecutionLeaseService, UpdateAgentRunnerService],
})
export class UpdateAgentModule {
  // Empty implementation
}
