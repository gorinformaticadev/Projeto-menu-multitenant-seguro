import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';

export interface PlatformConfig {
  platformName: string;
  platformEmail: string;
  platformPhone: string;
}

@Injectable()
export class PlatformConfigService {
  private readonly logger = new Logger(PlatformConfigService.name);
  private cachedConfig: PlatformConfig | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos

  constructor(private prisma: PrismaService) {}

  /**
   * Get platform configuration with caching
   */
  async getPlatformConfig(): Promise<PlatformConfig> {
    // Check cache first
    if (this.cachedConfig && (Date.now() - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.cachedConfig;
    }

    try {
      const securityConfig = await this.prisma.securityConfig.findFirst();
      
      const config: PlatformConfig = {
        platformName: securityConfig?.platformName || 'Sistema Multitenant',
        platformEmail: securityConfig?.platformEmail || 'contato@sistema.com',
        platformPhone: securityConfig?.platformPhone || '(11) 99999-9999',
      };

      // Update cache
      this.cachedConfig = config;
      this.cacheTimestamp = Date.now();

      return config;
    } catch (error) {
      this.logger.error('Error fetching platform configuration:', error);
      
      // Return default values on error
      return {
        platformName: 'Sistema Multitenant',
        platformEmail: 'contato@sistema.com',
        platformPhone: '(11) 99999-9999',
      };
    }
  }

  /**
   * Update platform configuration
   */
  async updatePlatformConfig(
    platformName?: string,
    platformEmail?: string,
    platformPhone?: string,
    userId?: string
  ): Promise<PlatformConfig> {
    try {
      // Get or create security config
      let securityConfig = await this.prisma.securityConfig.findFirst();
      
      const updateData: any = {
        updatedBy: userId,
      };

      if (platformName !== undefined) updateData.platformName = platformName;
      if (platformEmail !== undefined) updateData.platformEmail = platformEmail;
      if (platformPhone !== undefined) updateData.platformPhone = platformPhone;

      if (securityConfig) {
        // Update existing
        securityConfig = await this.prisma.securityConfig.update({
          where: { id: securityConfig.id },
          data: updateData,
        });
      } else {
        // Create new
        securityConfig = await this.prisma.securityConfig.create({
          data: {
            ...updateData,
            platformName: platformName || 'Sistema Multitenant',
            platformEmail: platformEmail || 'contato@sistema.com',
            platformPhone: platformPhone || '(11) 99999-9999',
          },
        });
      }

      // Clear cache
      this.cachedConfig = null;

      this.logger.log(`Platform configuration updated by user ${userId}`);
      
      return await this.getPlatformConfig();
    } catch (error) {
      this.logger.error('Error updating platform configuration:', error);
      throw error;
    }
  }

  /**
   * Get platform name
   */
  async getPlatformName(): Promise<string> {
    const config = await this.getPlatformConfig();
    return config.platformName;
  }

  /**
   * Get platform email
   */
  async getPlatformEmail(): Promise<string> {
    const config = await this.getPlatformConfig();
    return config.platformEmail;
  }

  /**
   * Get platform phone
   */
  async getPlatformPhone(): Promise<string> {
    const config = await this.getPlatformConfig();
    return config.platformPhone;
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.cachedConfig = null;
    this.cacheTimestamp = 0;
    this.logger.log('Platform configuration cache cleared');
  }
}
