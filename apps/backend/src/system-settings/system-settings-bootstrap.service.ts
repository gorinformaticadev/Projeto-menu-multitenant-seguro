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
        `Falha no bootstrap das configuracoes dinamicas. O runtime seguira com fallback de ENV/default. Causa: ${this.stringifyError(error)}`,
      );
    }
  }

  async bootstrapFromEnv(): Promise<void> {
    let createdCount = 0;

    for (const definition of this.settingsRegistry.getAll()) {
      const envValue = readEnvValueForSetting(definition);
      if (!envValue.present) {
        continue;
      }

      if (!envValue.ok) {
        this.logger.warn(
          `Ignorando bootstrap da configuracao dinamica "${definition.key}" porque o valor em ENV e invalido. Causa: ${envValue.reason}`,
        );
        continue;
      }

      try {
        const existing = await this.prisma.systemSetting.findUnique({
          where: { key: definition.key },
          select: { id: true },
        });

        if (existing) {
          continue;
        }

        await this.prisma.systemSetting.create({
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
          `Falha ao executar bootstrap da configuracao dinamica "${definition.key}" a partir do ENV. O runtime continuara sem override persistido. Causa: ${this.stringifyError(error)}`,
        );
        break;
      }
    }

    if (createdCount > 0) {
      this.logger.log(`Bootstrap de configuracoes dinamicas criou ${createdCount} registro(s) ausente(s) a partir do ENV.`);
    }
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
