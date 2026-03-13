import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigResolverService } from './config-resolver.service';
import { SettingsRegistry } from './settings-registry.service';
import { SystemSettingsAuditService } from './system-settings-audit.service';
import { SystemSettingsWriteService } from './system-settings-write.service';

describe('SystemSettingsWriteService', () => {
  const registry = new SettingsRegistry();
  const actor = {
    userId: 'super-admin-1',
    email: 'super-admin@example.com',
  };

  const createService = () => {
    const txMock = {
      systemSetting: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
      systemSettingAudit: {
        create: jest.fn(),
      },
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock)),
      updateSystemSettings: {
        update: jest.fn(),
      },
    };

    const resolverMock = {
      getResolved: jest.fn(),
    } as unknown as ConfigResolverService;

    return {
      txMock,
      prismaMock,
      resolverMock,
      service: new SystemSettingsWriteService(
        registry,
        resolverMock,
        prismaMock as any,
        new SystemSettingsAuditService(),
      ),
    };
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('persiste override valido e gera auditoria', async () => {
    const { service, txMock, prismaMock } = createService();
    txMock.systemSetting.findUnique.mockResolvedValue({
      valueJson: true,
    });
    txMock.systemSetting.upsert.mockResolvedValue({
      updatedAt: new Date('2026-03-13T16:20:00.000Z'),
      updatedByUserId: actor.userId,
    });

    const result = await service.updatePanelSetting(
      'notifications.enabled',
      false,
      actor,
      'disable notifications',
    );

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.systemSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          key: 'notifications.enabled',
        },
        create: expect.objectContaining({
          key: 'notifications.enabled',
          valueJson: false,
          source: 'panel',
          updatedByUserId: actor.userId,
        }),
        update: expect.objectContaining({
          valueJson: false,
          source: 'panel',
          updatedByUserId: actor.userId,
          version: {
            increment: 1,
          },
        }),
      }),
    );
    expect(txMock.systemSettingAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          settingKey: 'notifications.enabled',
          oldValueJson: true,
          newValueJson: false,
          changedByUserId: actor.userId,
          changedByEmail: actor.email,
          changeReason: 'disable notifications',
        }),
      }),
    );
    expect((prismaMock as any).updateSystemSettings.update).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        action: 'update',
        setting: expect.objectContaining({
          key: 'notifications.enabled',
          resolvedSource: 'database',
          resolvedValue: false,
          hasDatabaseOverride: true,
        }),
      }),
    );
  });

  it('remove override e restaura fallback com auditoria', async () => {
    const { service, txMock, resolverMock } = createService();
    txMock.systemSetting.findUnique.mockResolvedValue({
      key: 'notifications.enabled',
      valueJson: false,
    });
    txMock.systemSetting.delete.mockResolvedValue({});
    (resolverMock.getResolved as jest.Mock).mockResolvedValue({
      key: 'notifications.enabled',
      value: true,
      source: 'env',
      definition: registry.getOrThrow('notifications.enabled'),
    });

    const result = await service.restorePanelSettingFallback(
      'notifications.enabled',
      actor,
      'restore env fallback',
    );

    expect(txMock.systemSetting.delete).toHaveBeenCalledWith({
      where: {
        key: 'notifications.enabled',
      },
    });
    expect(txMock.systemSettingAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          settingKey: 'notifications.enabled',
          oldValueJson: false,
          newValueJson: null,
          changedByUserId: actor.userId,
          changedByEmail: actor.email,
          changeReason: 'restore env fallback',
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        action: 'restore_fallback',
        setting: expect.objectContaining({
          key: 'notifications.enabled',
          resolvedSource: 'env',
          resolvedValue: true,
          hasDatabaseOverride: false,
          lastUpdatedAt: null,
        }),
      }),
    );
  });

  it('rejeita chave fora da whitelist', async () => {
    const { service, prismaMock } = createService();

    await expect(service.updatePanelSetting('database.url', true, actor)).rejects.toThrow(
      BadRequestException,
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rejeita chave sensivel nao editavel', async () => {
    const { service, prismaMock } = createService();

    await expect(service.updatePanelSetting('security.headers.enabled', true, actor)).rejects.toThrow(
      BadRequestException,
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rejeita tipo invalido para boolean sem conversao implicita de string', async () => {
    const { service, prismaMock } = createService();

    await expect(service.updatePanelSetting('notifications.enabled', 'false', actor)).rejects.toThrow(
      BadRequestException,
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rejeita valor invalido segundo validator', async () => {
    const customRegistry = {
      get: jest.fn().mockReturnValue({
        key: 'custom.flag',
        type: 'boolean',
        defaultValue: true,
        label: 'Custom flag',
        description: 'Custom description',
        category: 'custom',
        envKey: 'CUSTOM_FLAG',
        restartRequired: false,
        sensitive: false,
        requiresConfirmation: false,
        allowedInPanel: true,
        editableInPanel: true,
        validator: jest.fn().mockReturnValue(false),
      }),
    } as unknown as SettingsRegistry;

    const txMock = {
      systemSetting: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
      systemSettingAudit: {
        create: jest.fn(),
      },
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock)),
    };

    const service = new SystemSettingsWriteService(
      customRegistry,
      {
        getResolved: jest.fn(),
      } as unknown as ConfigResolverService,
      prismaMock as any,
      new SystemSettingsAuditService(),
    );

    await expect(service.updatePanelSetting('custom.flag', true, actor)).rejects.toThrow(
      BadRequestException,
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('falha de banco retorna erro controlado sem quebrar o modo fail-open', async () => {
    const { service, prismaMock } = createService();
    prismaMock.$transaction.mockRejectedValueOnce(new Error('db offline'));

    await expect(service.updatePanelSetting('notifications.enabled', false, actor)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('restore fallback rejeita quando nao existe override persistido', async () => {
    const { service, txMock } = createService();
    txMock.systemSetting.findUnique.mockResolvedValue(null);

    await expect(service.restorePanelSettingFallback('notifications.enabled', actor)).rejects.toThrow(
      BadRequestException,
    );
    expect(txMock.systemSettingAudit.create).not.toHaveBeenCalled();
  });
});
