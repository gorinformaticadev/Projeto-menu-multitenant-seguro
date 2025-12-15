/**
 * NotificationManager - Gerenciador de notificações
 * Gerencia canais de notificação e envio de mensagens
 */

import {
  NotificationChannel,
  NotificationMessage,
  NotificationTarget,
  NotificationChannelHandler,
} from '../contracts/NotificationChannel';

/**
 * Gerenciador de notificações
 */
export class NotificationManager {
  private channels: Map<string, NotificationChannel> = new Map();

  /**
   * Registra um canal de notificação
   * @param name - Nome do canal
   * @param handler - Handler que processa as notificações
   * @param description - Descrição opcional do canal
   */
  public registerChannel(
    name: string,
    handler: NotificationChannelHandler,
    description?: string
  ): void {
    if (this.channels.has(name)) {
      console.warn(`Canal de notificação "${name}" já existe, substituindo...`);
    }

    this.channels.set(name, {
      name,
      handler,
      description,
      enabled: true,
    });

    console.log(`📢 Canal de notificação registrado: ${name}`);
  }

  /**
   * Remove um canal de notificação
   * @param name - Nome do canal
   * @returns true se removido com sucesso
   */
  public unregisterChannel(name: string): boolean {
    const removed = this.channels.delete(name);
    
    if (removed) {
      console.log(`Canal de notificação removido: ${name}`);
    }
    
    return removed;
  }

  /**
   * Habilita ou desabilita um canal
   * @param name - Nome do canal
   * @param enabled - Se deve estar habilitado
   */
  public setChannelEnabled(name: string, enabled: boolean): void {
    const channel = this.channels.get(name);
    
    if (channel) {
      channel.enabled = enabled;
      console.log(`Canal "${name}" ${enabled ? 'habilitado' : 'desabilitado'}`);
    }
  }

  /**
   * Envia uma notificação através de um canal específico
   * @param channelName - Nome do canal
   * @param message - Mensagem a enviar
   * @param targets - Alvos da notificação
   */
  public async send(
    channelName: string,
    message: NotificationMessage,
    targets: NotificationTarget[]
  ): Promise<void> {
    const channel = this.channels.get(channelName);

    if (!channel) {
      throw new Error(`Canal de notificação "${channelName}" não encontrado`);
    }

    if (!channel.enabled) {
      console.warn(`Canal "${channelName}" está desabilitado, notificação ignorada`);
      return;
    }

    try {
      await channel.handler(message, targets);
    } catch (error) {
      console.error(`Erro ao enviar notificação via canal "${channelName}":`, error);
      throw error;
    }
  }

  /**
   * Envia uma notificação para todos os canais habilitados
   * @param message - Mensagem a enviar
   * @param targets - Alvos da notificação
   */
  public async broadcast(
    message: NotificationMessage,
    targets?: NotificationTarget[]
  ): Promise<void> {
    const enabledChannels = Array.from(this.channels.values()).filter(c => c.enabled);

    if (enabledChannels.length === 0) {
      console.warn('Nenhum canal de notificação habilitado para broadcast');
      return;
    }

    const defaultTargets: NotificationTarget[] = targets || [];

    const promises = enabledChannels.map(channel =>
      channel.handler(message, defaultTargets).catch(error => {
        console.error(`Erro em broadcast via canal "${channel.name}":`, error);
      })
    );

    await Promise.allSettled(promises);
  }

  /**
   * Obtém um canal pelo nome
   * @param name - Nome do canal
   */
  public getChannel(name: string): NotificationChannel | undefined {
    return this.channels.get(name);
  }

  /**
   * Lista todos os canais registrados
   * @param onlyEnabled - Se deve retornar apenas canais habilitados
   */
  public getChannels(onlyEnabled = false): NotificationChannel[] {
    const channels = Array.from(this.channels.values());
    
    if (onlyEnabled) {
      return channels.filter(c => c.enabled);
    }
    
    return channels;
  }

  /**
   * Verifica se um canal existe
   * @param name - Nome do canal
   */
  public hasChannel(name: string): boolean {
    return this.channels.has(name);
  }

  /**
   * Limpa todos os canais
   */
  public clear(): void {
    this.channels.clear();
  }

  /**
   * Retorna quantidade de canais registrados
   */
  public count(): number {
    return this.channels.size;
  }

  /**
   * Debug - lista todos os canais
   */
  public debug(): void {
    console.log('=== Notification Manager Debug ===');
    console.log(`Total channels: ${this.count()}`);
    console.log(`Enabled: ${this.getChannels(true).length}`);
    console.log('\nChannels:');
    
    this.channels.forEach((channel, name) => {
      const status = channel.enabled ? '✅' : '❌';
      console.log(`  ${status} ${name}`);
      if (channel.description) {
        console.log(`      ${channel.description}`);
      }
    });
  }
}
