import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { access, unlink, writeFile } from 'fs/promises';
import { basename, resolve } from 'path';
import { PrismaService } from '@core/prisma/prisma.service';
import { resolveLogosDirPath, resolvePlatformLogoFilePath } from '@core/common/paths/paths.service';

export interface PlatformConfig {
  platformName: string;
  platformLogoUrl: string | null;
  platformEmail: string;
  platformPhone: string;
}

@Injectable()
export class PlatformConfigService {
  private readonly logger = new Logger(PlatformConfigService.name);
  private cachedConfig: PlatformConfig | null = null;
  private cacheTimestamp = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos

  constructor(private prisma: PrismaService) {}

  async getPlatformConfig(): Promise<PlatformConfig> {
    if (this.cachedConfig && Date.now() - this.cacheTimestamp < this.CACHE_TTL) {
      return this.cachedConfig;
    }

    try {
      const securityConfig = await this.prisma.securityConfig.findFirst();
      const platformLogoUrl = await this.resolveExistingPlatformLogo(securityConfig?.platformLogoUrl);

      const config: PlatformConfig = {
        platformName: securityConfig?.platformName || 'Sistema Multitenant',
        platformLogoUrl,
        platformEmail: securityConfig?.platformEmail || 'contato@sistema.com',
        platformPhone: securityConfig?.platformPhone || '(11) 99999-9999',
      };

      this.cachedConfig = config;
      this.cacheTimestamp = Date.now();
      return config;
    } catch (error) {
      this.logger.error('Error fetching platform configuration:', error);
      return {
        platformName: 'Sistema Multitenant',
        platformLogoUrl: null,
        platformEmail: 'contato@sistema.com',
        platformPhone: '(11) 99999-9999',
      };
    }
  }

  async updatePlatformConfig(
    platformName?: string,
    platformEmail?: string,
    platformPhone?: string,
    userId?: string,
  ): Promise<PlatformConfig> {
    try {
      const securityConfig = await this.getOrCreateSecurityConfig();
      const updateData: Record<string, unknown> = {
        updatedBy: userId,
      };

      if (platformName !== undefined) updateData.platformName = platformName;
      if (platformEmail !== undefined) updateData.platformEmail = platformEmail;
      if (platformPhone !== undefined) updateData.platformPhone = platformPhone;

      await this.prisma.securityConfig.update({
        where: { id: securityConfig.id },
        data: updateData,
      });

      this.clearCache();
      this.logger.log(`Platform configuration updated by user ${userId}`);
      return this.getPlatformConfig();
    } catch (error) {
      this.logger.error('Error updating platform configuration:', error);
      throw error;
    }
  }

  async updatePlatformLogo(upload: { buffer: Buffer; extension: string }, userId?: string) {
    const securityConfig = await this.getOrCreateSecurityConfig();
    const fileName = `${Date.now()}-${randomUUID()}${upload.extension}`;
    const logoPath = resolvePlatformLogoFilePath(fileName);
    await writeFile(logoPath, upload.buffer, { mode: 0o600 });

    const oldLogoPath = await this.resolveExistingPlatformLogoPath(securityConfig.platformLogoUrl);
    if (oldLogoPath) {
      try {
        await unlink(oldLogoPath);
      } catch {
        // noop
      }
    }

    await this.prisma.securityConfig.update({
      where: { id: securityConfig.id },
      data: {
        platformLogoUrl: fileName,
        updatedBy: userId,
      },
    });

    this.clearCache();
    this.logger.log(`Platform logo updated by user ${userId}`);
    return this.getPlatformConfig();
  }

  async removePlatformLogo(userId?: string) {
    const securityConfig = await this.prisma.securityConfig.findFirst({
      select: {
        id: true,
        platformLogoUrl: true,
      },
    });

    if (!securityConfig || !securityConfig.platformLogoUrl) {
      throw new BadRequestException('A plataforma nao possui logo configurado');
    }

    const logoPath = await this.resolveExistingPlatformLogoPath(securityConfig.platformLogoUrl);
    if (logoPath) {
      try {
        await unlink(logoPath);
      } catch {
        // noop
      }
    }

    await this.prisma.securityConfig.update({
      where: { id: securityConfig.id },
      data: {
        platformLogoUrl: null,
        updatedBy: userId,
      },
    });

    this.clearCache();
    this.logger.log(`Platform logo removed by user ${userId}`);
    return this.getPlatformConfig();
  }

  async getPlatformLogoFilePath() {
    const securityConfig = await this.prisma.securityConfig.findFirst({
      select: {
        platformLogoUrl: true,
      },
    });

    if (!securityConfig?.platformLogoUrl) {
      throw new NotFoundException('Logo da plataforma nao encontrado');
    }

    const logoPath = await this.resolveExistingPlatformLogoPath(securityConfig.platformLogoUrl);
    if (!logoPath) {
      throw new NotFoundException('Arquivo de logo da plataforma nao encontrado');
    }

    return logoPath;
  }

  async getPlatformName(): Promise<string> {
    const config = await this.getPlatformConfig();
    return config.platformName;
  }

  async getPlatformEmail(): Promise<string> {
    const config = await this.getPlatformConfig();
    return config.platformEmail;
  }

  async getPlatformPhone(): Promise<string> {
    const config = await this.getPlatformConfig();
    return config.platformPhone;
  }

  clearCache(): void {
    this.cachedConfig = null;
    this.cacheTimestamp = 0;
    this.logger.log('Platform configuration cache cleared');
  }

  private buildPlatformLogoPublicUrl() {
    return '/api/platform-config/logo-file';
  }

  private getSafeLogoFilename(logoUrl?: string | null): string | null {
    if (!logoUrl || typeof logoUrl !== 'string') {
      return null;
    }

    const normalized = logoUrl.trim();
    if (!normalized) {
      return null;
    }

    const safeName = basename(normalized);
    if (safeName !== normalized) {
      return null;
    }

    return safeName;
  }

  private async resolveExistingPlatformLogo(logoUrl?: string | null): Promise<string | null> {
    const logoPath = await this.resolveExistingPlatformLogoPath(logoUrl);
    if (!logoPath) {
      return null;
    }

    return this.buildPlatformLogoPublicUrl();
  }

  private async resolveExistingPlatformLogoPath(logoUrl?: string | null): Promise<string | null> {
    const safeName = this.getSafeLogoFilename(logoUrl);
    if (!safeName) {
      return null;
    }

    try {
      const platformLogoPath = resolvePlatformLogoFilePath(safeName);
      await access(platformLogoPath);
      return platformLogoPath;
    } catch {
      try {
        const legacyLogoPath = resolve(resolveLogosDirPath(), safeName);
        await access(legacyLogoPath);
        return legacyLogoPath;
      } catch {
        return null;
      }
    }
  }

  private async getOrCreateSecurityConfig() {
    const existing = await this.prisma.securityConfig.findFirst();
    if (existing) {
      return existing;
    }

    return this.prisma.securityConfig.create({
      data: {
        platformName: 'Sistema Multitenant',
        platformEmail: 'contato@sistema.com',
        platformPhone: '(11) 99999-9999',
      },
    });
  }
}
