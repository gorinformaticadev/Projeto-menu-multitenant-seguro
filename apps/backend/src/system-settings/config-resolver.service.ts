import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { SettingsRegistry } from './settings-registry.service';
import { ResolvedSetting, SettingDefinition, SettingValueSource } from './system-settings.types';
import { coerceSettingValue, readEnvValueForSetting } from './system-settings-value.utils';

@Injectable()
export class ConfigResolverService {
  private readonly logger = new Logger(ConfigResolverService.name);
  private readonly warnedUnknownKeys = new Set<string>();
  private readonly warnedDatabaseKeys = new Set<string>();
  private readonly warnedInvalidKeys = new Set<string>();

  constructor(
    private readonly settingsRegistry: SettingsRegistry,
    private readonly prisma: PrismaService,
  ) {}

  getMeta<T = unknown>(key: string): SettingDefinition<T> | null {
    return this.settingsRegistry.get<T>(key) ?? null;
  }

  async getResolved<T = unknown>(key: string): Promise<ResolvedSetting<T> | null> {
    const definition = this.settingsRegistry.get<T>(key);
    if (!definition) {
      this.warnUnknownKey(key);
      return null;
    }

    const databaseResolved = await this.resolveFromDatabase(definition);
    if (databaseResolved) {
      return databaseResolved;
    }

    const envResolved = this.resolveFromEnv(definition);
    if (envResolved) {
      return envResolved;
    }

    return {
      key: definition.key,
      value: definition.defaultValue,
      source: 'default',
      definition,
    };
  }

  async getBoolean(key: string): Promise<boolean | undefined> {
    return this.getTypedValue<boolean>(key, 'boolean');
  }

  async getNumber(key: string): Promise<number | undefined> {
    return this.getTypedValue<number>(key, 'number');
  }

  async getString(key: string): Promise<string | undefined> {
    return this.getTypedValue<string>(key, 'string');
  }

  async getJson<T = unknown>(key: string): Promise<T | undefined> {
    return this.getTypedValue<T>(key, 'json');
  }

  private async getTypedValue<T = unknown>(
    key: string,
    expectedType: SettingDefinition['type'],
  ): Promise<T | undefined> {
    const definition = this.settingsRegistry.get<T>(key);
    if (!definition) {
      this.warnUnknownKey(key);
      return undefined;
    }

    if (definition.type !== expectedType) {
      this.logger.warn(
        `Dynamic setting "${key}" requested as ${expectedType}, but registry type is ${definition.type}.`,
      );
      return undefined;
    }

    const resolved = await this.getResolved<T>(key);
    return resolved?.value;
  }

  private async resolveFromDatabase<T = unknown>(
    definition: SettingDefinition<T>,
  ): Promise<ResolvedSetting<T> | null> {
    try {
      const setting = await (this.prisma as any).systemSetting.findUnique({
        where: { key: definition.key },
      });

      if (!setting) {
        return null;
      }

      const coerced = coerceSettingValue(definition, setting.valueJson, 'database');
      if (!coerced.ok) {
        this.warnInvalidValue(definition.key, 'database', coerced.reason || 'invalid value');
        return null;
      }

      return {
        key: definition.key,
        value: coerced.value as T,
        source: 'database',
        definition,
      };
    } catch (error) {
      this.warnDatabaseFailure(definition.key, error);
      return null;
    }
  }

  private resolveFromEnv<T = unknown>(definition: SettingDefinition<T>): ResolvedSetting<T> | null {
    const envValue = readEnvValueForSetting(definition);
    if (!envValue.present) {
      return null;
    }

    if (!envValue.ok) {
      this.warnInvalidValue(definition.key, 'env', envValue.reason || 'invalid env value');
      return null;
    }

    return {
      key: definition.key,
      value: envValue.value as T,
      source: 'env',
      definition,
    };
  }

  private warnUnknownKey(key: string): void {
    if (this.warnedUnknownKeys.has(key)) {
      return;
    }
    this.warnedUnknownKeys.add(key);
    this.logger.warn(`Dynamic setting "${key}" is not registered and will be ignored.`);
  }

  private warnDatabaseFailure(key: string, error: unknown): void {
    if (this.warnedDatabaseKeys.has(key)) {
      return;
    }
    this.warnedDatabaseKeys.add(key);
    this.logger.warn(
      `Failed to read dynamic setting "${key}" from database. Falling back to ENV/default. Cause: ${this.stringifyError(error)}`,
    );
  }

  private warnInvalidValue(key: string, source: SettingValueSource, reason: string): void {
    const warningKey = `${source}:${key}`;
    if (this.warnedInvalidKeys.has(warningKey)) {
      return;
    }
    this.warnedInvalidKeys.add(warningKey);
    this.logger.warn(
      `Dynamic setting "${key}" has an invalid ${source} value. Falling back to next source. Cause: ${reason}`,
    );
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
