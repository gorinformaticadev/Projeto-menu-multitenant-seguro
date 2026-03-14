/**
 * WHATSAPP MODULE - Módulo WhatsApp (preparação futura)
 */

import { Module } from '@nestjs/common';
import { WhatsAppGateway } from './whatsapp.gateway';
import { WhatsAppBus } from './whatsapp.bus';
import { WebsocketRuntimeToggleService } from '@common/services/websocket-runtime-toggle.service';

@Module({
  providers: [WhatsAppGateway, WhatsAppBus, WebsocketRuntimeToggleService],
  exports: [WhatsAppBus],
})
export class WhatsAppModule {
      // Empty implementation
    }
