import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  connectRedisClient,
  createRedisClientFromTopology,
  describeRedisTopology,
  getRedisClientStatus,
  isRedisClientReady,
  quitRedisClient,
  type RedisClientLike,
  resolveRedisTopologyConfig,
} from './redis-topology.util';

const REDIS_RELEASE_LOCK_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
else
    return 0
end
`;

@Injectable()
export class RedisLockService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisLockService.name);
  private redis?: RedisClientLike;
  private readonly topologyConfig = resolveRedisTopologyConfig();
  private fallbackActive = false;

  constructor() {
    // A topologia e resolvida via ambiente compartilhado para manter
    // consistencia com o restante da infraestrutura distribuida.
  }

  async onModuleInit(): Promise<void> {
    if (!this.topologyConfig.enabled) {
      this.logger.warn(
        'RedisLockService: Redis distribuido nao configurado. Locks distribuidos operarao em modo degradado explicito.',
      );
      return;
    }

    this.redis = createRedisClientFromTopology(this.topologyConfig);
    if (!this.redis) {
      this.logger.warn(
        `RedisLockService: topologia invalida para ${describeRedisTopology(this.topologyConfig)}. Modo degradado ativo.`,
      );
      this.fallbackActive = true;
      return;
    }

    this.redis.on('error', (error) => {
      if (!this.fallbackActive) {
        this.logger.error(
          `Erro no RedisLockService (${describeRedisTopology(this.topologyConfig)}): ${error.message}. Modo degradado ativo.`,
        );
        this.fallbackActive = true;
      }
    });

    this.redis.on('ready', () => {
      if (this.fallbackActive) {
        this.logger.log('RedisLockService reconectado.');
        this.fallbackActive = false;
      }
    });

    try {
      await connectRedisClient(this.redis);
    } catch (error) {
      this.logger.error(`Falha ao conectar ao Redis no bootstrap: ${String(error)}`);
      this.fallbackActive = true;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await quitRedisClient(this.redis);
  }

  isDegraded(): boolean {
    return !this.redis || this.fallbackActive || !isRedisClientReady(this.redis);
  }

  /**
   * Adquire um lock distribuido.
   * @param key Chave do lock
   * @param ttlMs Tempo de vida em milissegundos
   * @param ownerId Identificador do dono (instanceId ou token)
   */
  async acquireLock(key: string, ttlMs: number, ownerId: string): Promise<boolean> {
    if (this.isDegraded()) {
      return false; // Em degradado, nao garante exclusividade
    }

    try {
      const result = await this.redis!.set(key, ownerId, 'PX', ttlMs, 'NX');
      return result === 'OK';
    } catch (error) {
      this.logger.warn(
        `Falha ao adquirir lock ${key}. status=${getRedisClientStatus(this.redis)} detalhe=${String(error)}`,
      );
      return false;
    }
  }

  /**
   * Libera um lock distribuido apenas se pertencer ao ownerId.
   */
  async releaseLock(key: string, ownerId: string): Promise<boolean> {
    if (this.isDegraded()) {
      return false;
    }

    try {
      const result = await this.redis!.eval(REDIS_RELEASE_LOCK_SCRIPT, 1, key, ownerId);
      return result === 1;
    } catch (error) {
      this.logger.warn(
        `Falha ao liberar lock ${key}. status=${getRedisClientStatus(this.redis)} detalhe=${String(error)}`,
      );
      return false;
    }
  }

  /**
   * Define um cooldown distribuido.
   */
  async setCooldown(key: string, durationMs: number): Promise<void> {
    if (this.isDegraded()) {
      return;
    }

    try {
      await this.redis!.set(key, '1', 'PX', durationMs);
    } catch (error) {
      this.logger.warn(
        `Falha ao definir cooldown ${key}. status=${getRedisClientStatus(this.redis)} detalhe=${String(error)}`,
      );
    }
  }

  /**
   * Verifica se o cooldown esta ativo.
   */
  async hasCooldown(key: string): Promise<boolean> {
    if (this.isDegraded()) {
      return false; // Em degradado, assume que nao ha cooldown para nao bloquear em falso
    }

    try {
      const result = await this.redis!.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.warn(
        `Falha ao verificar cooldown ${key}. status=${getRedisClientStatus(this.redis)} detalhe=${String(error)}`,
      );
      return false;
    }
  }
}
