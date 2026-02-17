/**
 * SOCKET CLIENT - Cliente Socket.IO para notificações
 */

import { io, Socket } from 'socket.io-client';

class SocketClient {
  private socket: Socket | null = null;
  private token: string | null = null;

  /**
   * Conecta ao servidor Socket.IO
   */
  connect(token: string): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.token = token;
    
    let backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    
    // Se a URL contém /api, removemos para a conexão do socket
    const baseUrl = backendUrl.replace(/\/api$/, '');
    
    this.socket = io(`${baseUrl}/notifications`, {
      path: '/socket.io',
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    this.setupEventListeners();
    
    return this.socket;
  }

  /**
   * Desconecta do servidor
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Obtém a instância do socket
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Verifica se está conectado
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Emite evento para marcar notificação como lida
   */
  markAsRead(notificationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('notification:mark-read', { id: notificationId });
    }
  }

  /**
   * Emite evento para marcar todas como lidas
   */
  markAllAsRead(): void {
    if (this.socket?.connected) {
      this.socket.emit('notification:mark-all-read');
    }
  }

  /**
   * Emite evento para deletar notificação
   */
  deleteNotification(notificationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('notification:delete', { id: notificationId });
    }
  }

  /**
   * Registra listener para eventos
   */
  on(event: string, callback: (...args: unknown[]) => void): void {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  /**
   * Remove listener de eventos
   */
  off(event: string, callback?: (...args: unknown[]) => void): void {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  // ============================================================================
  // MÉTODOS PRIVADOS
  // ============================================================================

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      // console.log('✅ Socket.IO conectado para notificações');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket.IO desconectado:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Erro de conexão Socket.IO:', error);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`🔄 Socket.IO reconectado (tentativa ${attemptNumber})`);
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('❌ Erro de reconexão Socket.IO:', error);
    });
  }
}

// Exporta instância singleton
export const socketClient = new SocketClient();
