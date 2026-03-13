import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { SettingsRegistry } from './settings-registry.service';
import { readEnvValueForSetting } from './system-settings-value.utils';

@Injectable()
export class SystemSettingsBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SystemSettingsBootstrapService.name);

  constructor(
    private readonly settingsRegistry: SettingsRegistry,
    private readonly prisma: PrismaService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.bootstrapFromEnv();
    } catch (error) {
      this.logger.warn(
        `Dynamic settings bootstrap failed. Runtime will continue with ENV/default fallbacks. Cause: ${this.stringifyError(error)}`,
      );
    }
  }

  async bootstrapFromEnv(): Promise<void> {
    let createdCount = 0;
    const prisma = this.prisma as any;

    for (const definition of this.settingsRegistry.getAll()) {
      const envValue = readEnvValueForSetting(definition);
      if (!envValue.present) {
        continue;
      }

      if (!envValue.ok) {
        this.logger.warn(
          `Skipping bootstrap for dynamic setting "${definition.key}" because ENV value is invalid. Cause: ${envValue.reason}`,
        );
        continue;
      }

      try {
        const existing = await prisma.systemSetting.findUnique({
          where: { key: definition.key },
          select: { id: true },
        });

        if (existing) {
          continue;
        }

        await prisma.systemSetting.create({
          data: {
            key: definition.key,
            valueJson: envValue.value,
            valueType: definition.type,
            category: definition.category,
            scope: 'system',
            tenantId: null,
            source: 'seed_env',
            updatedByUserId: null,
            version: 1,
          },
        });

        createdCount += 1;
      } catch (error) {
        this.logger.warn(
          `Failed to bootstrap dynamic setting "${definition.key}" from ENV. Runtime will continue without persisted override. Cause: ${this.stringifyError(error)}`,
        );
        break;
      }
    }

    if (createdCount > 0) {
      this.logger.log(`Dynamic settings bootstrap created ${createdCount} missing record(s) from ENV.`);
    }
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
