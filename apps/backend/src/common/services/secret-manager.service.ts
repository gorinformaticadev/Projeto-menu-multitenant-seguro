import * as fs from 'fs';
import * as path from 'path';
import { parse as parseDotenv } from 'dotenv';

export interface Secret {
  name: string;
  value: string;
  version?: string;
  createdDate?: Date;
  lastModifiedDate?: Date;
  description?: string;
}

export interface SecretManager {
  getSecret(name: string): Promise<Secret | null>;
  putSecret(name: string, value: string, description?: string): Promise<Secret>;
  deleteSecret(name: string): Promise<boolean>;
  listSecrets(prefix?: string): Promise<Secret[]>;
  isAvailable(): Promise<boolean>;
  getProviderName(): string;
}

export class LocalSecretManager implements SecretManager {
  private secrets: Map<string, Secret> = new Map();

  constructor() {
    this.loadFromEnvironment();
  }

  private loadFromEnvironment(): void {
    this.loadFromDotEnvFiles();

    const envSecrets = [
      'JWT_SECRET',
      'ENCRYPTION_KEY',
      'TRUSTED_DEVICE_TOKEN_SECRET',
      'DATABASE_URL',
      'SMTP_PASSWORD',
      'SENTRY_DSN',
    ];

    for (const secretName of envSecrets) {
      const value = process.env[secretName];
      if (!value) {
        continue;
      }

      this.secrets.set(secretName, {
        name: secretName,
        value,
        createdDate: new Date(),
        lastModifiedDate: new Date(),
      });
    }
  }

  private loadFromDotEnvFiles(): void {
    const nodeEnv = String(process.env.NODE_ENV || '').trim();
    const cwd = process.cwd();
    const backendRoot = path.resolve(__dirname, '../../..');
    const candidateFiles = [
      '.env',
      nodeEnv ? `.env.${nodeEnv}` : null,
      '.env.local',
      nodeEnv ? `.env.${nodeEnv}.local` : null,
    ].filter((value): value is string => Boolean(value));

    const resolvedPaths = new Set<string>();
    for (const baseDir of [cwd, backendRoot]) {
      for (const candidateFile of candidateFiles) {
        resolvedPaths.add(path.resolve(baseDir, candidateFile));
      }
    }

    for (const filePath of resolvedPaths) {
      if (!fs.existsSync(filePath)) {
        continue;
      }

      try {
        const parsed = parseDotenv(fs.readFileSync(filePath));
        for (const [name, value] of Object.entries(parsed)) {
          if (!value || process.env[name]) {
            continue;
          }

          process.env[name] = value;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`Failed to parse local env file ${filePath}: ${message}`);
      }
    }
  }

  async getSecret(name: string): Promise<Secret | null> {
    return this.secrets.get(name) || null;
  }

  async putSecret(name: string, value: string, description?: string): Promise<Secret> {
    const secret: Secret = {
      name,
      value,
      description,
      createdDate: new Date(),
      lastModifiedDate: new Date(),
    };

    this.secrets.set(name, secret);
    return secret;
  }

  async deleteSecret(name: string): Promise<boolean> {
    return this.secrets.delete(name);
  }

  async listSecrets(prefix?: string): Promise<Secret[]> {
    const allSecrets = Array.from(this.secrets.values());
    if (!prefix) {
      return allSecrets;
    }

    return allSecrets.filter((secret) => secret.name.startsWith(prefix));
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getProviderName(): string {
    return 'Local';
  }
}

export class AWSSecretManager implements SecretManager {
  private client: any;

  constructor() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const AWS = require('aws-sdk');
      this.client = new AWS.SecretsManager({
        region: process.env.AWS_REGION || 'us-east-1',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('AWS SDK not available:', message);
      this.client = null;
    }
  }

  async getSecret(name: string): Promise<Secret | null> {
    if (!this.client) {
      return null;
    }

    try {
      const response = await this.client.getSecretValue({ SecretId: name }).promise();

      return {
        name: response.Name,
        value: response.SecretString,
        version: response.VersionId,
        createdDate: response.CreatedDate ? new Date(response.CreatedDate) : undefined,
        lastModifiedDate: response.LastChangedDate
          ? new Date(response.LastChangedDate)
          : undefined,
      };
    } catch (error: any) {
      if (error?.code === 'ResourceNotFoundException') {
        return null;
      }

      throw error;
    }
  }

  async putSecret(name: string, value: string, description?: string): Promise<Secret> {
    if (!this.client) {
      throw new Error('AWS Secrets Manager not available');
    }

    const params: Record<string, unknown> = {
      Name: name,
      SecretString: value,
    };

    if (description) {
      params.Description = description;
    }

    const response = await this.client.createSecret(params).promise();

    return {
      name: response.Name,
      value,
      version: response.VersionId,
      createdDate: new Date(),
      lastModifiedDate: new Date(),
      description,
    };
  }

  async deleteSecret(name: string): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      await this.client.deleteSecret({
        SecretId: name,
        ForceDeleteWithoutRecovery: false,
      }).promise();
      return true;
    } catch (error) {
      console.error('Error deleting secret:', error);
      return false;
    }
  }

  async listSecrets(prefix?: string): Promise<Secret[]> {
    if (!this.client) {
      return [];
    }

    try {
      const params: Record<string, unknown> = {};
      if (prefix) {
        params.Filters = [{ Key: 'name', Values: [prefix] }];
      }

      const response = await this.client.listSecrets(params).promise();
      return response.SecretList.map((secret: any) => ({
        name: secret.Name,
        value: '',
        version: secret.LastChangedDate,
        createdDate: secret.CreatedDate ? new Date(secret.CreatedDate) : undefined,
        lastModifiedDate: secret.LastChangedDate
          ? new Date(secret.LastChangedDate)
          : undefined,
        description: secret.Description,
      }));
    } catch (error) {
      console.error('Error listing secrets:', error);
      return [];
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      await this.client.listSecrets({ MaxResults: 1 }).promise();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('AWS Secrets Manager not reachable:', message);
      return false;
    }
  }

  getProviderName(): string {
    return 'AWS Secrets Manager';
  }
}

export class SecretManagerFactory {
  static async createSecretManager(): Promise<SecretManager> {
    if (process.env.SECRET_PROVIDER === 'aws' || process.env.AWS_SECRET_ACCESS_KEY) {
      const awsManager = new AWSSecretManager();
      if (await awsManager.isAvailable()) {
        return awsManager;
      }
    }

    if (process.env.SECRET_PROVIDER === 'azure' || process.env.AZURE_CLIENT_ID) {
      console.warn('Azure Key Vault not implemented yet');
    }

    if (process.env.SECRET_PROVIDER === 'vault' || process.env.VAULT_ADDR) {
      console.warn('HashiCorp Vault not implemented yet');
    }

    if (
      process.env.SECRET_PROVIDER === 'google' ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS
    ) {
      console.warn('Google Secret Manager not implemented yet');
    }

    return new LocalSecretManager();
  }

  static async loadApplicationSecrets(): Promise<void> {
    const secretManager = await this.createSecretManager();
    const requiredSecrets = [
      'JWT_SECRET',
      'ENCRYPTION_KEY',
      'TRUSTED_DEVICE_TOKEN_SECRET',
      'DATABASE_URL',
    ];

    for (const secretName of requiredSecrets) {
      try {
        const secret = await secretManager.getSecret(secretName);
        if (secret?.value) {
          process.env[secretName] = secret.value;
        } else {
          console.warn(`Secret not found: ${secretName}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Error loading secret ${secretName}:`, message);
      }
    }
  }
}

export class SecretLoaderMiddleware {
  static async loadSecrets(): Promise<void> {
    await SecretManagerFactory.loadApplicationSecrets();

    const criticalSecrets = [
      'JWT_SECRET',
      'ENCRYPTION_KEY',
      'TRUSTED_DEVICE_TOKEN_SECRET',
    ];

    for (const secret of criticalSecrets) {
      if (!process.env[secret]) {
        throw new Error(`Secret crítico não encontrado: ${secret}`);
      }
    }
  }
}
