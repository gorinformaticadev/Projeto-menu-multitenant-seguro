import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

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
  private redis?: Redis;
  private readonly redisEnabled: boolean;
  private fallbackActive = false;

  constructor() {
    this.redisEnabled = String(process.env.REDIS_HOST || '').trim() !== '';
  }

  async onModuleInit(): Promise<void> {
    if (!this.redisEnabled) {
      this.logger.warn('RedisLockService: REDIS_HOST nao configurado. Modo degradado sera acionado para operacoes distribuidas.');
      return;
    }

    const host = String(process.env.REDIS_HOST || '127.0.0.1').trim();
    const port = Number.parseInt(String(process.env.REDIS_PORT || '6379'), 10);
    const password = String(process.env.REDIS_PASSWORD || '').trim();
    const username = String(process.env.REDIS_USERNAME || '').trim();
    const db = Number.parseInt(String(process.env.REDIS_DB || '0'), 10);

    this.redis = new Redis({
      host,
      port,
      username: username || undefined,
      password: password || undefined,
      db,
      connectTimeout: 2000,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    this.redis.on('error', (error) => {
      if (!this.fallbackActive) {
        this.logger.error(`Erro no RedisLockService: ${error.message}. Modo degradado ativo.`);
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
      await this.redis.connect();
    } catch (error) {
      this.logger.error(`Falha ao conectar ao Redis no bootstrap: ${String(error)}`);
      this.fallbackActive = true;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch {
        this.redis.disconnect();
      }
    }
  }

  isDegraded(): boolean {
    return !this.redis || this.fallbackActive || this.redis.status !== 'ready';
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
      this.logger.warn(`Falha ao adquirir lock ${key}: ${String(error)}`);
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
      this.logger.warn(`Falha ao liberar lock ${key}: ${String(error)}`);
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
      this.logger.warn(`Falha ao definir cooldown ${key}: ${String(error)}`);
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
      this.logger.warn(`Falha ao verificar cooldown ${key}: ${String(error)}`);
      return false;
    }
  }
}
