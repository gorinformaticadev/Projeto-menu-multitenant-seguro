/**
 * WHATSAPP BUS - Orquestrador WhatsApp (preparação futura)
 * 
 * Estrutura preparada para integração com WhatsApp via Socket.IO
 */

import { Injectable, Logger } from '@nestjs/common';
import { WhatsAppMessage, WhatsAppEvent } from './whatsapp.types';

@Injectable()
export class WhatsAppBus {
  private readonly logger = new Logger(WhatsAppBus.name);

  /**
   * Processa mensagem do WhatsApp (estrutura futura)
   */
  async processMessage(message: WhatsAppMessage): Promise<void> {
    this.logger.log(`WhatsApp message processing prepared: ${message.id}`);
    // Implementação futura
  }

  /**
   * Emite evento via Socket.IO (estrutura futura)
   */
  async emitEvent(event: WhatsAppEvent): Promise<void> {
    this.logger.log(`WhatsApp event emission prepared: ${event.type}`);
    // Implementação futura
  }
}