import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { ConfigResolverService } from './config-resolver.service';
import { SettingsRegistry } from './settings-registry.service';
import {
  SystemSettingReadItemDto,
  SystemSettingLastUpdatedByDto,
  SystemSettingsReadResponseDto,
} from './dto/system-settings-read.dto';

type SettingRecord = {
  key: string;
  updatedAt: Date;
  updatedByUserId: string | null;
};

type UserSummary = {
  id: string;
  email: string | null;
  name: string | null;
};

@Injectable()
export class SystemSettingsReadService {
  private readonly logger = new Logger(SystemSettingsReadService.name);

  constructor(
    private readonly settingsRegistry: SettingsRegistry,
    private readonly configResolver: ConfigResolverService,
    private readonly prisma: PrismaService,
  ) {}

  async listPanelSettings(): Promise<SystemSettingsReadResponseDto> {
    const definitions = [...this.settingsRegistry.getAllowedInPanel()].sort((left, right) => {
      if (left.category !== right.category) {
        return left.category.localeCompare(right.category);
      }

      return left.label.localeCompare(right.label);
    });
    const keys = definitions.map((definition) => definition.key);
    const overridesByKey = await this.loadOverrides(keys);
    const usersById = await this.loadUsers(overridesByKey);

    const data = await Promise.all(
      definitions.map(async (definition) => {
        const resolved = await this.configResolver.getResolved(definition.key);
        const override = overridesByKey.get(definition.key);
        const actor = override?.updatedByUserId ? usersById.get(override.updatedByUserId) ?? null : null;

        return this.buildItem({
          definition,
          resolvedValue: resolved?.value,
          resolvedSource: resolved?.source ?? 'default',
          override,
          actor,
        });
      }),
    );

    return {
      data,
      meta: {
        total: data.length,
        categories: [...new Set(data.map((item) => item.category))],
      },
    };
  }

  private buildItem(params: {
    definition: ReturnType<SettingsRegistry['getOrThrow']>;
    resolvedValue: unknown;
    resolvedSource: 'database' | 'env' | 'default';
    override?: SettingRecord;
    actor: UserSummary | null;
  }): SystemSettingReadItemDto {
    const { actor, definition, override, resolvedSource, resolvedValue } = params;
    const valueHidden = definition.sensitive === true;

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
      valueHidden,
      resolvedValue: valueHidden ? null : resolvedValue,
      resolvedSource,
      hasDatabaseOverride: !!override,
      lastUpdatedAt: override?.updatedAt?.toISOString() ?? null,
      lastUpdatedBy: this.mapActor(actor, override?.updatedByUserId ?? null),
    };
  }

  private async loadOverrides(keys: string[]): Promise<Map<string, SettingRecord>> {
    if (keys.length === 0) {
      return new Map<string, SettingRecord>();
    }

    try {
      const rows = await this.prisma.systemSetting.findMany({
        where: {
          key: {
            in: keys,
          },
        },
        select: {
          key: true,
          updatedAt: true,
          updatedByUserId: true,
        },
      });

      return new Map<string, SettingRecord>(
        rows.map((row) => [
          row.key,
          {
            key: row.key,
            updatedAt: row.updatedAt,
            updatedByUserId: row.updatedByUserId ?? null,
          },
        ]),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to read dynamic setting overrides for admin listing. Falling back to resolver only. Cause: ${this.stringifyError(error)}`,
      );
      return new Map<string, SettingRecord>();
    }
  }

  private async loadUsers(overridesByKey: Map<string, SettingRecord>): Promise<Map<string, UserSummary>> {
    const userIds = [...new Set([...overridesByKey.values()].map((item) => item.updatedByUserId).filter(Boolean))];

    if (userIds.length === 0) {
      return new Map<string, UserSummary>();
    }

    try {
      const users = await this.prisma.user.findMany({
        where: {
          id: {
            in: userIds,
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });

      return new Map<string, UserSummary>(
        users.map((user) => [
          user.id,
          {
            id: user.id,
            email: user.email ?? null,
            name: user.name ?? null,
          },
        ]),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to read setting actors for admin listing. Continuing without actor metadata. Cause: ${this.stringifyError(error)}`,
      );
      return new Map<string, UserSummary>();
    }
  }

  private mapActor(actor: UserSummary | null, userId: string | null): SystemSettingLastUpdatedByDto | null {
    if (!actor && !userId) {
      return null;
    }

    return {
      userId: actor?.id ?? userId,
      email: actor?.email ?? null,
      name: actor?.name ?? null,
    };
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
