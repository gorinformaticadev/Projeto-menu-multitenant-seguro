/**
 * WHATSAPP MODULE - Módulo WhatsApp (preparação futura)
 */

import { Module } from '@nestjs/common';
import { WhatsAppGateway } from './whatsapp.gateway';
import { WhatsAppBus } from './whatsapp.bus';

@Module({
  providers: [WhatsAppGateway, WhatsAppBus],
  exports: [WhatsAppBus],
})
export class WhatsAppModule {
      // Empty implementation
    }