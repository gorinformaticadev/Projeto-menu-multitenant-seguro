import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';

export type AuthSchemaCapabilities = {
  hasTwoFactorPendingSecretColumn: boolean;
  hasSessionVersionColumn: boolean;
  hasTrustedDevicesTable: boolean;
  hasUserPreferencesTable: boolean;
  hasUserSessionsTable: boolean;
};

@Injectable()
export class AuthSchemaCompatibilityService {
  private readonly logger = new Logger(AuthSchemaCompatibilityService.name);
  private capabilitiesPromise: Promise<AuthSchemaCapabilities> | null = null;
  private legacyWarningLogged = false;

  constructor(private readonly prisma: PrismaService) {}

  async getCapabilities(): Promise<AuthSchemaCapabilities> {
    if (!this.capabilitiesPromise) {
      this.capabilitiesPromise = this.loadCapabilities();
    }

    return this.capabilitiesPromise;
  }

  private async loadCapabilities(): Promise<AuthSchemaCapabilities> {
    const [userColumns, tables] = await Promise.all([
      this.prisma.$queryRawUnsafe<Array<{ column_name: string }>>(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
      `),
      this.prisma.$queryRawUnsafe<Array<{ table_name: string }>>(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('trusted_devices', 'user_preferences', 'user_sessions')
      `),
    ]);

    const userColumnSet = new Set(
      userColumns
        .map((row) => String(row?.column_name || '').trim())
        .filter((value) => value.length > 0),
    );
    const tableSet = new Set(
      tables
        .map((row) => String(row?.table_name || '').trim())
        .filter((value) => value.length > 0),
    );

    const capabilities: AuthSchemaCapabilities = {
      hasTwoFactorPendingSecretColumn: userColumnSet.has('twoFactorPendingSecret'),
      hasSessionVersionColumn: userColumnSet.has('sessionVersion'),
      hasTrustedDevicesTable: tableSet.has('trusted_devices'),
      hasUserPreferencesTable: tableSet.has('user_preferences'),
      hasUserSessionsTable: tableSet.has('user_sessions'),
    };

    this.logLegacyCompatibilityWarning(capabilities);

    return capabilities;
  }

  private logLegacyCompatibilityWarning(capabilities: AuthSchemaCapabilities) {
    if (this.legacyWarningLogged) {
      return;
    }

    const missingParts: string[] = [];

    if (!capabilities.hasTwoFactorPendingSecretColumn) {
      missingParts.push('users.twoFactorPendingSecret');
    }

    if (!capabilities.hasSessionVersionColumn) {
      missingParts.push('users.sessionVersion');
    }

    if (!capabilities.hasTrustedDevicesTable) {
      missingParts.push('trusted_devices');
    }

    if (!capabilities.hasUserPreferencesTable) {
      missingParts.push('user_preferences');
    }

    if (!capabilities.hasUserSessionsTable) {
      missingParts.push('user_sessions');
    }

    if (missingParts.length === 0) {
      return;
    }

    this.legacyWarningLogged = true;
    this.logger.warn(
      `Legacy auth schema compatibility mode enabled. Missing database objects: ${missingParts.join(', ')}.`,
    );
  }
}
