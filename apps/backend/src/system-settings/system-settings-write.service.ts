import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';
import { ConfigResolverService } from './config-resolver.service';
import { SettingsRegistry } from './settings-registry.service';
import { SystemSettingReadItemDto } from './dto/system-settings-read.dto';
import { SystemSettingMutationResponseDto } from './dto/system-settings-write.dto';
import { SystemSettingsAuditActor, SystemSettingsAuditService } from './system-settings-audit.service';
import { coerceIncomingSettingValue } from './system-settings-value.utils';
import { SettingDefinition } from './system-settings.types';

export interface SystemSettingsWriteActor extends SystemSettingsAuditActor {}

type StoredSettingRecord = {
  updatedAt: Date;
  updatedByUserId: string | null;
};

@Injectable()
export class SystemSettingsWriteService {
  private readonly logger = new Logger(SystemSettingsWriteService.name);

  constructor(
    private readonly settingsRegistry: SettingsRegistry,
    private readonly configResolver: ConfigResolverService,
    private readonly prisma: PrismaService,
    private readonly systemSettingsAuditService: SystemSettingsAuditService,
  ) {}

  async updatePanelSetting(
    key: string,
    rawValue: unknown,
    actor: SystemSettingsWriteActor,
    changeReason?: string,
  ): Promise<SystemSettingMutationResponseDto> {
    const definition = this.ensureWritableDefinition(key);
    const normalized = coerceIncomingSettingValue(definition, rawValue);

    if (!normalized.ok) {
      throw new BadRequestException(normalized.reason || `Valor invalido para a configuracao "${key}"`);
    }

    try {
      const persisted = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.systemSetting.findUnique({
          where: { key: definition.key },
          select: {
            valueJson: true,
          },
        });

        const record = await tx.systemSetting.upsert({
          where: { key: definition.key },
          create: {
            key: definition.key,
            valueJson: normalized.value as Prisma.InputJsonValue,
            valueType: definition.type,
            category: definition.category,
            scope: 'system',
            tenantId: null,
            source: 'panel',
            updatedByUserId: actor.userId,
            version: 1,
          },
          update: {
            valueJson: normalized.value as Prisma.InputJsonValue,
            valueType: definition.type,
            category: definition.category,
            scope: 'system',
            tenantId: null,
            source: 'panel',
            updatedByUserId: actor.userId,
            version: {
              increment: 1,
            },
          },
          select: {
            updatedAt: true,
            updatedByUserId: true,
          },
        });

        await this.systemSettingsAuditService.createAuditRecord(tx, {
          definition,
          key: definition.key,
          oldValue: existing?.valueJson,
          newValue: normalized.value,
          actor,
          changeReason,
        });

        return record;
      });

      return {
        action: 'update',
        setting: this.buildDatabaseSettingItem(definition, normalized.value, persisted, actor),
      };
    } catch (error) {
      this.logger.warn(
        `Failed to persist dynamic setting "${definition.key}" from admin panel. Cause: ${this.stringifyError(error)}`,
      );
      throw new ServiceUnavailableException(
        'Nao foi possivel persistir a configuracao dinamica no momento. Tente novamente.',
      );
    }
  }

  async restorePanelSettingFallback(
    key: string,
    actor: SystemSettingsWriteActor,
    changeReason?: string,
  ): Promise<SystemSettingMutationResponseDto> {
    const definition = this.ensureWritableDefinition(key);

    try {
      await this.prisma.$transaction(async (tx) => {
        const existing = await tx.systemSetting.findUnique({
          where: { key: definition.key },
          select: {
            key: true,
            valueJson: true,
          },
        });

        if (!existing) {
          throw new BadRequestException(
            `A configuracao "${definition.key}" nao possui override em banco para restaurar o fallback.`,
          );
        }

        await tx.systemSetting.delete({
          where: { key: definition.key },
        });

        await this.systemSettingsAuditService.createAuditRecord(tx, {
          definition,
          key: definition.key,
          oldValue: existing.valueJson,
          newValue: undefined,
          actor,
          changeReason,
        });
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.warn(
        `Failed to restore fallback for dynamic setting "${definition.key}". Cause: ${this.stringifyError(error)}`,
      );
      throw new ServiceUnavailableException(
        'Nao foi possivel restaurar o fallback da configuracao dinamica no momento. Tente novamente.',
      );
    }

    const resolved = await this.configResolver.getResolved(definition.key);
    const resolvedValue = resolved?.value ?? definition.defaultValue;
    const resolvedSource = resolved?.source === 'env' ? 'env' : 'default';

    return {
      action: 'restore_fallback',
      setting: this.buildFallbackSettingItem(definition, resolvedValue, resolvedSource),
    };
  }

  private ensureWritableDefinition(key: string): SettingDefinition {
    const definition = this.settingsRegistry.get(key);

    if (!definition) {
      throw new BadRequestException(`A configuracao dinamica "${key}" nao esta registrada.`);
    }

    if (!definition.allowedInPanel) {
      throw new BadRequestException(`A configuracao dinamica "${key}" nao pode ser gerenciada pelo painel.`);
    }

    if (!definition.editableInPanel) {
      throw new BadRequestException(`A configuracao dinamica "${key}" nao pode ser alterada nesta etapa.`);
    }

    if (definition.sensitive) {
      throw new BadRequestException(`A configuracao dinamica "${key}" e sensivel e nao pode ser alterada.`);
    }

    return definition;
  }

  private buildDatabaseSettingItem(
    definition: SettingDefinition,
    value: unknown,
    record: StoredSettingRecord,
    actor: SystemSettingsWriteActor,
  ): SystemSettingReadItemDto {
    return {
      key: definition.key,
      label: definition.label,
      description: definition.description,
      category: definition.category,
      type: definition.type,
      allowedInPanel: definition.allowedInPanel,
      editableInPanel: definition.editableInPanel,
      restartRequired: definition.restartRequired,
      requiresConfirmation: definition.requiresConfirmation,
      sensitive: definition.sensitive,
      valueHidden: definition.sensitive,
      resolvedValue: definition.sensitive ? null : value,
      resolvedSource: 'database',
      hasDatabaseOverride: true,
      lastUpdatedAt: record.updatedAt.toISOString(),
      lastUpdatedBy: {
        userId: record.updatedByUserId ?? actor.userId,
        email: actor.email,
        name: null,
      },
    };
  }

  private buildFallbackSettingItem(
    definition: SettingDefinition,
    value: unknown,
    source: 'env' | 'default',
  ): SystemSettingReadItemDto {
    return {
      key: definition.key,
      label: definition.label,
      description: definition.description,
      category: definition.category,
      type: definition.type,
      allowedInPanel: definition.allowedInPanel,
      editableInPanel: definition.editableInPanel,
      restartRequired: definition.restartRequired,
      requiresConfirmation: definition.requiresConfirmation,
      sensitive: definition.sensitive,
      valueHidden: definition.sensitive,
      resolvedValue: definition.sensitive ? null : value,
      resolvedSource: source,
      hasDatabaseOverride: false,
      lastUpdatedAt: null,
      lastUpdatedBy: null,
    };
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
