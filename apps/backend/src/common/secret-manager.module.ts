import { Module, Global } from '@nestjs/common';
import { SecretManagerService } from './services/secret-manager.nest.service';

@Global()
@Module({
  providers: [SecretManagerService],
  exports: [SecretManagerService],
})
export class SecretManagerModule {
      // Empty implementation
    }