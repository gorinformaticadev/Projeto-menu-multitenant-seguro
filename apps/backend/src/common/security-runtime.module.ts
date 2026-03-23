import { Global, Module } from '@nestjs/common';
import { AuthorizationService } from './services/authorization.service';
import { RequestSecurityContextService } from './services/request-security-context.service';
import { WebsocketConnectionRegistryService } from './services/websocket-connection-registry.service';

@Global()
@Module({
  providers: [
    RequestSecurityContextService,
    AuthorizationService,
    WebsocketConnectionRegistryService,
  ],
  exports: [
    RequestSecurityContextService,
    AuthorizationService,
    WebsocketConnectionRegistryService,
  ],
})
export class SecurityRuntimeModule {}
