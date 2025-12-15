/**
 * Event Bus - Sistema de eventos do CORE
 * Permite comunicação desacoplada entre CORE e módulos
 */

import { EventMap, EventName, EventListener } from './event-types';

/**
 * Event Bus principal do sistema
 * Singleton que gerencia todos os eventos da plataforma
 */
export class EventBus {
  private static instance: EventBus;
  private listeners: Map<string, EventListener[]> = new Map();
  private asyncEvents: Set<EventName> = new Set([
    'user:authenticated',
    'tenant:resolved',
  ]);

  private constructor() {}

  /**
   * Obtém instância única do Event Bus
   */
  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Registra um listener para um evento
   * @param event - Nome do evento
   * @param listener - Função a ser chamada quando o evento disparar
   */
  public on<K extends EventName>(
    event: K,
    listener: EventListener<EventMap[K]>
  ): void {
    const eventName = event as string;
    
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }

    this.listeners.get(eventName)!.push(listener as EventListener);
  }

  /**
   * Remove um listener de um evento
   * @param event - Nome do evento
   * @param listener - Função a ser removida
   */
  public off<K extends EventName>(
    event: K,
    listener: EventListener<EventMap[K]>
  ): void {
    const eventName = event as string;
    const listeners = this.listeners.get(eventName);

    if (listeners) {
      const index = listeners.indexOf(listener as EventListener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Dispara um evento de forma síncrona ou assíncrona
   * @param event - Nome do evento
   * @param payload - Dados do evento
   */
  public async emit<K extends EventName>(
    event: K,
    payload: EventMap[K]
  ): Promise<void> {
    const eventName = event as string;
    const listeners = this.listeners.get(eventName) || [];

    // Eventos assíncronos (fire and forget)
    if (this.asyncEvents.has(event)) {
      // Não aguarda conclusão dos listeners
      listeners.forEach(listener => {
        Promise.resolve(listener(payload)).catch(error => {
          console.error(`Erro em listener assíncrono de ${eventName}:`, error);
        });
      });
      return;
    }

    // Eventos síncronos (aguarda conclusão)
    for (const listener of listeners) {
      try {
        await Promise.resolve(listener(payload));
      } catch (error) {
        console.error(`Erro em listener síncrono de ${eventName}:`, error);
        // Não interrompe a execução de outros listeners
      }
    }
  }

  /**
   * Remove todos os listeners de um evento
   * @param event - Nome do evento
   */
  public removeAllListeners(event?: EventName): void {
    if (event) {
      this.listeners.delete(event as string);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Retorna quantidade de listeners registrados para um evento
   * @param event - Nome do evento
   */
  public listenerCount(event: EventName): number {
    const eventName = event as string;
    return this.listeners.get(eventName)?.length || 0;
  }

  /**
   * Lista todos os eventos registrados
   */
  public eventNames(): EventName[] {
    return Array.from(this.listeners.keys()) as EventName[];
  }
}

// Exporta instância única
export const eventBus = EventBus.getInstance();
