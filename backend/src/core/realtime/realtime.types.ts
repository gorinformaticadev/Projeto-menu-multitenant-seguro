/**
 * REALTIME TYPES - Tipos para abstração SSE/Socket.IO
 * 
 * Define contratos para comunicação em tempo real
 */

export interface RealtimeMessage {
  type: string;
  data: any;
  timestamp: Date;
  tenantId?: string | null;
  userId?: string | null;
}

export interface RealtimeChannel {
  name: string;
  tenantId?: string | null;
  userId?: string | null;
}

export interface RealtimeTransport {
  emit(channel: RealtimeChannel, message: RealtimeMessage): Promise<void>;
  subscribe(channel: RealtimeChannel, callback: (message: RealtimeMessage) => void): void;
  unsubscribe(channel: RealtimeChannel): void;
}

export interface SSEConnection {
  id: string;
  tenantId?: string | null;
  userId?: string | null;
  response: any; // Express Response object
  lastPing: Date;
}

export interface SSEMessage {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}