import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { ConfigResolverService } from '../../system-settings/config-resolver.service';
import { SettingsRegistry } from '../../system-settings/settings-registry.service';
import {
  buildAdvancedCspHeaderValue,
  resolveAdvancedCspSetting,
} from '../http-csp-advanced';

@Injectable()
export class CspMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CspMiddleware.name);
  private readonly configCacheTtlMs = 15000;
  private cachedEnabled: boolean | null = null;
  private configExpiresAt = 0;

  constructor(
    private readonly settingsRegistry: SettingsRegistry,
    private readonly configResolver: ConfigResolverService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!(await this.isAdvancedCspEnabledCached())) {
        next();
        return;
      }

      const nonce = crypto.randomBytes(16).toString('base64');
      res.locals.nonce = nonce;

      const cspHeader = buildAdvancedCspHeaderValue({
        nonce,
        isProduction: process.env.NODE_ENV === 'production',
        frontendUrl: process.env.FRONTEND_URL,
        sentryDsn: process.env.SENTRY_DSN,
      });

      res.setHeader('Content-Security-Policy', cspHeader);
    } catch (error) {
      this.logger.warn(
        `Failed to apply advanced CSP dynamically. Preserving existing HTTP pipeline. Cause: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    next();
  }

  private async isAdvancedCspEnabledCached(): Promise<boolean> {
    const now = Date.now();

    if (this.cachedEnabled !== null && now < this.configExpiresAt) {
      return this.cachedEnabled;
    }

    const resolved = await resolveAdvancedCspSetting(
      this.settingsRegistry,
      this.configResolver,
      this.logger,
    );

    this.cachedEnabled = resolved.value === true;
    this.configExpiresAt = now + this.configCacheTtlMs;

    return this.cachedEnabled;
  }
}
