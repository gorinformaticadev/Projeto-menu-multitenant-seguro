/**
 * WHATSAPP TYPES - Tipos para integração futura com WhatsApp
 * 
 * Estrutura preparada para Socket.IO e chat
 */

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  type: 'text' | 'image' | 'document' | 'audio';
  timestamp: Date;
  tenantId?: string;
  metadata?: Record<string, any>;
}

export interface WhatsAppContact {
  id: string;
  phone: string;
  name?: string;
  tenantId: string;
  isActive: boolean;
  lastSeen?: Date;
}

export interface WhatsAppSession {
  id: string;
  tenantId: string;
  contactId: string;
  status: 'active' | 'inactive' | 'blocked';
  createdAt: Date;
  lastActivity: Date;
}

export interface WhatsAppEvent {
  type: 'message_received' | 'message_sent' | 'contact_online' | 'contact_offline';
  data: unknown;
  tenantId: string;
  timestamp: Date;
}