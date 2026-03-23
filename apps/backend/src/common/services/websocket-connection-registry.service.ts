import { Injectable } from '@nestjs/common';

type RegisteredConnection = {
  clientId: string;
  userId: string;
  tenantId: string | null;
  sessionId: string | null;
  disconnect: (close?: boolean) => void;
  emit?: (event: string, payload: unknown) => void;
};

@Injectable()
export class WebsocketConnectionRegistryService {
  private readonly byClientId = new Map<string, RegisteredConnection>();
  private readonly clientIdsByUserId = new Map<string, Set<string>>();
  private readonly clientIdsBySessionId = new Map<string, Set<string>>();

  register(connection: RegisteredConnection): void {
    this.unregister(connection.clientId);

    this.byClientId.set(connection.clientId, connection);
    this.index(this.clientIdsByUserId, connection.userId, connection.clientId);

    if (connection.sessionId) {
      this.index(this.clientIdsBySessionId, connection.sessionId, connection.clientId);
    }
  }

  unregister(clientId: string): void {
    const existing = this.byClientId.get(clientId);
    if (!existing) {
      return;
    }

    this.byClientId.delete(clientId);
    this.deindex(this.clientIdsByUserId, existing.userId, clientId);

    if (existing.sessionId) {
      this.deindex(this.clientIdsBySessionId, existing.sessionId, clientId);
    }
  }

  disconnectSession(sessionId: string, reason = 'SESSION_REVOKED'): void {
    this.disconnectIndexedConnections(this.clientIdsBySessionId.get(sessionId), reason);
  }

  disconnectUser(userId: string, reason = 'SESSION_REVOKED'): void {
    this.disconnectIndexedConnections(this.clientIdsByUserId.get(userId), reason);
  }

  private disconnectIndexedConnections(clientIds: Set<string> | undefined, reason: string): void {
    if (!clientIds || clientIds.size === 0) {
      return;
    }

    for (const clientId of [...clientIds]) {
      const connection = this.byClientId.get(clientId);
      if (!connection) {
        continue;
      }

      try {
        connection.emit?.('notification:error', {
          message: 'Sessao encerrada por politica de seguranca.',
          code: reason,
        });
      } catch {
        // Melhor esforco: nao impedir a desconexao.
      }

      try {
        connection.disconnect(true);
      } finally {
        this.unregister(clientId);
      }
    }
  }

  private index(index: Map<string, Set<string>>, key: string, clientId: string): void {
    const current = index.get(key) || new Set<string>();
    current.add(clientId);
    index.set(key, current);
  }

  private deindex(index: Map<string, Set<string>>, key: string, clientId: string): void {
    const current = index.get(key);
    if (!current) {
      return;
    }

    current.delete(clientId);
    if (current.size === 0) {
      index.delete(key);
    }
  }
}
