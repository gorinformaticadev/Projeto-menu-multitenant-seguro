import { PlatformConfigService } from '../../security-config/platform-config.service';

/**
 * Default platform configuration values
 */
export const DEFAULT_PLATFORM_CONFIG = {
  PLATFORM_NAME: 'Sistema Multitenant',
  PLATFORM_EMAIL: 'contato@sistema.com',
  PLATFORM_PHONE: '(11) 99999-9999',
} as const;

/**
 * Platform configuration cache
 */
let platformConfigCache: {
  platformName: string;
  platformEmail: string;
  platformPhone: string;
} | null = null;

let platformConfigService: PlatformConfigService | null = null;

/**
 * Initialize platform config service
 */
export function initializePlatformConfig(service: PlatformConfigService) {
  platformConfigService = service;
}

/**
 * Get platform name
 */
export async function getPlatformName(): Promise<string> {
  if (!platformConfigService) {
    return DEFAULT_PLATFORM_CONFIG.PLATFORM_NAME;
  }

  try {
    return await platformConfigService.getPlatformName();
  } catch (error) {
    console.warn('Failed to get platform name, using default:', error);
    return DEFAULT_PLATFORM_CONFIG.PLATFORM_NAME;
  }
}

/**
 * Get platform email
 */
export async function getPlatformEmail(): Promise<string> {
  if (!platformConfigService) {
    return DEFAULT_PLATFORM_CONFIG.PLATFORM_EMAIL;
  }

  try {
    return await platformConfigService.getPlatformEmail();
  } catch (error) {
    console.warn('Failed to get platform email, using default:', error);
    return DEFAULT_PLATFORM_CONFIG.PLATFORM_EMAIL;
  }
}

/**
 * Get platform phone
 */
export async function getPlatformPhone(): Promise<string> {
  if (!platformConfigService) {
    return DEFAULT_PLATFORM_CONFIG.PLATFORM_PHONE;
  }

  try {
    return await platformConfigService.getPlatformPhone();
  } catch (error) {
    console.warn('Failed to get platform phone, using default:', error);
    return DEFAULT_PLATFORM_CONFIG.PLATFORM_PHONE;
  }
}

/**
 * Get all platform configuration
 */
export async function getPlatformConfig(): Promise<{
  platformName: string;
  platformEmail: string;
  platformPhone: string;
}> {
  if (!platformConfigService) {
    return {
      platformName: DEFAULT_PLATFORM_CONFIG.PLATFORM_NAME,
      platformEmail: DEFAULT_PLATFORM_CONFIG.PLATFORM_EMAIL,
      platformPhone: DEFAULT_PLATFORM_CONFIG.PLATFORM_PHONE,
    };
  }

  try {
    return await platformConfigService.getPlatformConfig();
  } catch (error) {
    console.warn('Failed to get platform config, using defaults:', error);
    return {
      platformName: DEFAULT_PLATFORM_CONFIG.PLATFORM_NAME,
      platformEmail: DEFAULT_PLATFORM_CONFIG.PLATFORM_EMAIL,
      platformPhone: DEFAULT_PLATFORM_CONFIG.PLATFORM_PHONE,
    };
  }
}

/**
 * Synchronous getters (use cached values or defaults)
 */
export const PLATFORM = {
  /**
   * Get platform name (synchronous, uses cache or default)
   */
  get NAME(): string {
    return platformConfigCache?.platformName || DEFAULT_PLATFORM_CONFIG.PLATFORM_NAME;
  },

  /**
   * Get platform email (synchronous, uses cache or default)
   */
  get EMAIL(): string {
    return platformConfigCache?.platformEmail || DEFAULT_PLATFORM_CONFIG.PLATFORM_EMAIL;
  },

  /**
   * Get platform phone (synchronous, uses cache or default)
   */
  get PHONE(): string {
    return platformConfigCache?.platformPhone || DEFAULT_PLATFORM_CONFIG.PLATFORM_PHONE;
  },

  /**
   * Update cache
   */
  updateCache(config: { platformName: string; platformEmail: string; platformPhone: string }) {
    platformConfigCache = config;
  },

  /**
   * Clear cache
   */
  clearCache() {
    platformConfigCache = null;
  },
} as const;