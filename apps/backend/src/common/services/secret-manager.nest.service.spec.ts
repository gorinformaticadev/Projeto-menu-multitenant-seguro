import * as fs from 'fs';
import { SecretManagerService } from './secret-manager.nest.service';

describe('SecretManagerService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
    delete process.env.SECRET_PROVIDER;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_REGION;
    delete process.env.AZURE_CLIENT_ID;
    delete process.env.VAULT_ADDR;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.REQUIRE_SECRET_MANAGER;
    process.env.JWT_SECRET = 'jwt-secret-for-local-tests-with-at-least-32-characters';
    process.env.ENCRYPTION_KEY =
      'encryption-key-for-local-tests-with-at-least-32-characters';
    delete process.env.TRUSTED_DEVICE_TOKEN_SECRET;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('auto provisions the trusted device secret for the local provider outside production', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    process.env.NODE_ENV = 'development';
    const service = new SecretManagerService();

    await service.initialize();

    expect(service.getProviderName()).toBe('Local');
    expect(process.env.TRUSTED_DEVICE_TOKEN_SECRET).toBeDefined();
    expect(String(process.env.TRUSTED_DEVICE_TOKEN_SECRET).length).toBeGreaterThanOrEqual(32);
    expect(process.env.TRUSTED_DEVICE_TOKEN_SECRET).not.toBe(process.env.JWT_SECRET);
    expect(service.validateCriticalSecrets()).toBe(true);
  });

  it('keeps production strict and does not auto provision missing critical secrets', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    process.env.NODE_ENV = 'production';
    const service = new SecretManagerService();

    await expect(service.initialize()).rejects.toThrow(
      'Secret crítico não encontrado: TRUSTED_DEVICE_TOKEN_SECRET',
    );
  });
});
