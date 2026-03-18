/**
 * SOCKET CLIENT - Cliente Socket.IO para notificacoes
 */

import { io, Socket } from "socket.io-client";

class SocketClient {
  private socket: Socket | null = null;

  /**
   * Conecta ao servidor Socket.IO usando os cookies HttpOnly da sessao.
   */
  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "/api";
    const baseUrl = backendUrl.replace(/\/api$/, "");

    this.socket = io(`${baseUrl}/notifications`, {
      path: "/socket.io",
      withCredentials: true,
      transports: ["websocket", "polling"],
      timeout: 20000,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.setupEventListeners();

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  markAsRead(notificationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit("notification:mark-read", { id: notificationId });
    }
  }

  markAllAsRead(): void {
    if (this.socket?.connected) {
      this.socket.emit("notification:mark-all-read");
    }
  }

  deleteNotification(notificationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit("notification:delete", { id: notificationId });
    }
  }

  on(event: string, callback: (...args: unknown[]) => void): void {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (...args: unknown[]) => void): void {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      // noop
    });

    this.socket.on("disconnect", (reason) => {
      console.log("Socket.IO desconectado:", reason);
    });

    this.socket.on("connect_error", (error) => {
      console.error("Erro de conexao Socket.IO:", error);
    });

    this.socket.on("reconnect", (attemptNumber) => {
      console.log(`Socket.IO reconectado (tentativa ${attemptNumber})`);
    });

    this.socket.on("reconnect_error", (error) => {
      console.error("Erro de reconexao Socket.IO:", error);
    });
  }
}

export const socketClient = new SocketClient();
