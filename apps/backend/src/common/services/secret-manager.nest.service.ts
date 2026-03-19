import { randomBytes } from 'crypto';
import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  SecretManagerFactory,
  SecretLoaderMiddleware,
  SecretManager as ISecretManager,
  Secret,
} from './secret-manager.service';

@Injectable()
export class SecretManagerService implements OnModuleInit {
  private secretManager: ISecretManager | null = null;
  private isInitialized = false;

  async onModuleInit() {
    await this.initialize();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.secretManager = await SecretManagerFactory.createSecretManager();

      await this.ensureLocalCriticalSecrets();
      await SecretLoaderMiddleware.loadSecrets();

      this.isInitialized = true;
      console.warn(`Secret Manager initialized (${this.secretManager.getProviderName()})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Failed to initialize Secret Manager:', message);
      throw error;
    }
  }

  async getSecret(name: string): Promise<Secret | null> {
    if (!this.secretManager) {
      throw new Error('Secret Manager not initialized');
    }

    return this.secretManager.getSecret(name);
  }

  async putSecret(name: string, value: string, description?: string): Promise<Secret> {
    if (!this.secretManager) {
      throw new Error('Secret Manager not initialized');
    }

    return this.secretManager.putSecret(name, value, description);
  }

  async deleteSecret(name: string): Promise<boolean> {
    if (!this.secretManager) {
      throw new Error('Secret Manager not initialized');
    }

    return this.secretManager.deleteSecret(name);
  }

  async listSecrets(prefix?: string): Promise<Secret[]> {
    if (!this.secretManager) {
      throw new Error('Secret Manager not initialized');
    }

    return this.secretManager.listSecrets(prefix);
  }

  async isAvailable(): Promise<boolean> {
    if (!this.secretManager) {
      return false;
    }

    return this.secretManager.isAvailable();
  }

  getProviderName(): string {
    if (!this.secretManager) {
      return 'Unknown';
    }

    return this.secretManager.getProviderName();
  }

  async loadApplicationSecrets(): Promise<void> {
    if (!this.secretManager) {
      throw new Error('Secret Manager not initialized');
    }

    const secretsToLoad = [
      'JWT_SECRET',
      'ENCRYPTION_KEY',
      'TRUSTED_DEVICE_TOKEN_SECRET',
      'DATABASE_URL',
      'SMTP_PASSWORD',
      'SENTRY_DSN',
    ];

    for (const secretName of secretsToLoad) {
      try {
        const secret = await this.getSecret(secretName);
        if (secret?.value) {
          process.env[secretName] = secret.value;
        } else {
          console.warn(`Missing optional secret during load: ${secretName}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to load secret ${secretName}:`, message);
      }
    }
  }

  validateCriticalSecrets(): boolean {
    const criticalSecrets = [
      'JWT_SECRET',
      'ENCRYPTION_KEY',
      'TRUSTED_DEVICE_TOKEN_SECRET',
    ];

    let allPresent = true;

    for (const secretName of criticalSecrets) {
      if (!process.env[secretName]) {
        console.error(`Critical secret missing: ${secretName}`);
        allPresent = false;
      }
    }

    return allPresent;
  }

  async setDevelopmentSecret(name: string, value: string): Promise<void> {
    if (process.env.NODE_ENV !== 'development') {
      throw new Error('setDevelopmentSecret can only be used in development');
    }

    await this.putSecret(name, value, `Development secret - ${new Date().toISOString()}`);
    process.env[name] = value;
  }

  clearSensitiveData(): void {
    console.warn('Clearing sensitive data from memory (best effort)');
  }

  private async ensureLocalCriticalSecrets(): Promise<void> {
    if (!this.secretManager) {
      return;
    }

    if (this.secretManager.getProviderName() !== 'Local') {
      return;
    }

    if (process.env.NODE_ENV === 'production') {
      return;
    }

    if (process.env.REQUIRE_SECRET_MANAGER === 'true') {
      return;
    }

    const trustedDeviceSecret = String(
      process.env.TRUSTED_DEVICE_TOKEN_SECRET || '',
    ).trim();

    if (trustedDeviceSecret) {
      return;
    }

    let generatedSecret = randomBytes(48).toString('base64url');
    if (generatedSecret === process.env.JWT_SECRET) {
      generatedSecret = `${generatedSecret}-${randomBytes(8).toString('hex')}`;
    }

    await this.secretManager.putSecret(
      'TRUSTED_DEVICE_TOKEN_SECRET',
      generatedSecret,
      `Auto-provisioned local secret at ${new Date().toISOString()}`,
    );
    process.env.TRUSTED_DEVICE_TOKEN_SECRET = generatedSecret;

    console.warn(
      'TRUSTED_DEVICE_TOKEN_SECRET was missing for the Local provider. A secure value was generated for this process.',
    );
  }
}
