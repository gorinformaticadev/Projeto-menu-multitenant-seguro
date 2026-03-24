import { HttpException } from '@nestjs/common';
import * as fs from 'fs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';
import { SystemVersionService } from '@common/services/system-version.service';
import { AuditService } from '../audit/audit.service';
import { SystemUpdateAdminService } from './system-update-admin.service';
import { UpdateService } from './update.service';

type UpdateServicePrivateApi = {
  execFileAsync: jest.Mock;
  getRemoteTagsOutput: (repoUrl: string, encryptedGitToken?: string) => Promise<string>;
  encryptToken: (token: string) => string;
  sanitizeGitError: (output: string, token?: string) => string;
  formatVersion: (version: string) => string;
  runSafeNativeDeploy: (version: string, settings: Record<string, unknown>) => Promise<{ stdout: string; stderr: string }>;
  normalizeHttpStatus: (statusLike: unknown, fallback?: number) => number;
  getProjectRoot?: () => string;
};

function createService() {
  process.env.ENCRYPTION_KEY = '12345678901234567890123456789012-strong-key-material';

  const prismaMock = {
    updateSystemSettings: {
      findFirst: jest.fn(async () => ({
        id: 'settings-1',
        appVersion: 'v1.0.0',
        gitToken: null,
        gitUsername: 'org',
        gitRepository: 'repo',
        gitReleaseBranch: 'main',
        packageManager: 'docker',
        updateCheckEnabled: true,
        updateChannel: 'release',
        lastUpdateCheck: null,
        availableVersion: null,
        updateAvailable: false,
        releaseTag: 'latest',
        composeFile: 'docker-compose.prod.yml',
        envFile: 'install/.env.production',
        updatedAt: new Date(),
        updatedBy: null,
      })),
      create: jest.fn(async ({ data }) => ({ id: 'settings-1', ...data })),
      update: jest.fn(async ({ data }) => ({ id: 'settings-1', ...data })),
    },
    $queryRaw: jest.fn(async () => [
      { column_name: 'id' },
      { column_name: 'gitUsername' },
      { column_name: 'gitRepository' },
      { column_name: 'gitReleaseBranch' },
      { column_name: 'packageManager' },
      { column_name: 'updateCheckEnabled' },
      { column_name: 'updateChannel' },
      { column_name: 'releaseTag' },
      { column_name: 'composeFile' },
      { column_name: 'envFile' },
      { column_name: 'updatedAt' },
      { column_name: 'updatedBy' },
    ]),
    $queryRawUnsafe: jest.fn(async () => []),
    $executeRaw: jest.fn(async () => 1),
    updateLog: {
      findFirst: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
      create: jest.fn(async ({ data }) => ({
        id: 'log-1',
        startedAt: new Date('2026-03-12T00:00:00Z'),
        ...data,
      })),
      update: jest.fn(async ({ where, data }) => ({
        id: where.id,
        startedAt: new Date('2026-03-12T00:00:00Z'),
        ...data,
      })),
      findUnique: jest.fn(async () => null),
    },
  };

  const auditMock = {
    log: jest.fn(async () => undefined),
  };

  const systemVersionMock = {
    getVersionInfo: jest.fn(() => ({
      version: 'v1.0.0',
      commitSha: 'test-sha',
      buildDate: '2026-01-01T00:00:00Z',
    })),
  };

  const systemUpdateAdminServiceMock = {
    runUpdate: jest.fn(async () => ({
      success: true,
      operationId: 'update-123',
      message: 'Update iniciado para versao v1.2.3.',
    })),
    getStatus: jest.fn(async () => ({
      status: 'idle',
      mode: 'docker',
      startedAt: null,
      finishedAt: null,
      fromVersion: 'v1.0.0',
      toVersion: 'unknown',
      step: 'idle',
      progress: 0,
      lock: false,
      lastError: null,
      errorCode: null,
      errorCategory: null,
      errorStage: null,
      exitCode: null,
      userMessage: null,
      technicalMessage: null,
      rollback: {
        attempted: false,
        completed: false,
        reason: null,
      },
      operation: {
        active: false,
        operationId: null,
        type: null,
      },
      stale: false,
    })),
  };

  const service = new UpdateService(
    prismaMock as unknown as PrismaService,
    auditMock as unknown as AuditService,
    systemVersionMock as unknown as SystemVersionService,
    systemUpdateAdminServiceMock as unknown as SystemUpdateAdminService,
  );

  return {
    service: service as unknown as any,
    prismaMock,
    auditMock,
    systemUpdateAdminServiceMock,
  };
}

describe('UpdateService', () => {
  it('repo publico sem token chama git ls-remote --tags', async () => {
    const { service } = createService();
    const calls: Array<{ cmd: string; args: string[] }> = [];

    service.execFileAsync = jest.fn(async (cmd: string, args: string[]) => {
      calls.push({ cmd, args });
      return { stdout: 'hash\trefs/tags/v1.2.3\n', stderr: '' };
    });

    const out = await service.getRemoteTagsOutput('https://github.com/org/repo.git');

    expect(out.includes('refs/tags/v1.2.3')).toBe(true);
    expect(calls).toEqual([
      {
        cmd: 'git',
        args: ['ls-remote', '--tags', 'https://github.com/org/repo.git'],
      },
    ]);
  });

  it('repo privado com token usa http.extraHeader Authorization basic', async () => {
    const { service } = createService();
    const calls: Array<{ cmd: string; args: string[] }> = [];

    service.execFileAsync = jest.fn(async (cmd: string, args: string[]) => {
      calls.push({ cmd, args });
      return { stdout: 'hash\trefs/tags/v2.0.0\n', stderr: '' };
    });

    const encryptedToken = service.encryptToken('my-secret-token');
    await service.getRemoteTagsOutput('https://github.com/org/private.git', encryptedToken);

    expect(calls.length).toBe(1);
    expect(calls[0].cmd).toBe('git');
    expect(calls[0].args[0]).toBe('-c');
    expect(calls[0].args[1].startsWith('http.extraHeader=AUTHORIZATION: basic ')).toBe(true);
    expect(calls[0].args.slice(2)).toEqual(['ls-remote', '--tags', 'https://github.com/org/private.git']);
  });

  it('sanitizacao remove Authorization/basic e token', () => {
    const { service } = createService();
    const token = 'my-secret-token';
    const basic = Buffer.from(`x-access-token:${token}`, 'utf8').toString('base64');
    const input = `fatal: auth failed AUTHORIZATION: basic ${basic} token=${token}`;

    const out = service.sanitizeGitError(input, token);

    expect(out.includes(token)).toBe(false);
    expect(out.includes(basic)).toBe(false);
    expect(out.includes('AUTHORIZATION: basic [REDACTED]')).toBe(true);
  });

  it('formatVersion normaliza para vX.Y.Z', () => {
    const { service } = createService();

    expect(service.formatVersion('1.2.3')).toBe('v1.2.3');
    expect(service.formatVersion('v1.2.3')).toBe('v1.2.3');
  });

  it('prioriza tags da mesma linha major.minor da versao atual', async () => {
    const { service } = createService();

    jest.spyOn(service as unknown as { getRuntimeVersionInfo: () => { version: string } }, 'getRuntimeVersionInfo')
      .mockReturnValue({ version: 'v0.1.67' });

    service.execFileAsync = jest.fn(async () => ({
      stdout: [
        'hash\trefs/tags/v3.3.0',
        'hash\trefs/tags/v0.1.68',
        'hash\trefs/tags/v0.1.67',
      ].join('\n'),
      stderr: '',
    }));

    const result = await service.checkForUpdates();

    expect(result.availableVersion).toBe('v0.1.68');
    expect(result.updateAvailable).toBe(true);
  });

  it('runSafeNativeDeploy injeta repo e auth header quando git esta configurado', async () => {
    const { service } = createService();
    const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((target: fs.PathLike) => {
      return String(target).replace(/\\/g, '/').endsWith('/install/update-native.sh');
    });

    const calls: Array<{ cmd: string; args: string[]; options: Record<string, any> }> = [];
    jest.spyOn(service as unknown as { getProjectRoot: () => string }, 'getProjectRoot').mockReturnValue('/repo-root');
    service.execFileAsync = jest.fn(async (cmd: string, args: string[], options: Record<string, any>) => {
      calls.push({ cmd, args, options });
      return { stdout: 'ok', stderr: '' };
    });

    const encryptedToken = service.encryptToken('my-secret-token');
    await service.runSafeNativeDeploy('v1.2.3', {
      gitUsername: 'org',
      gitRepository: 'repo',
      gitToken: encryptedToken,
    });

    expect(calls.length).toBe(1);
    expect(calls[0].cmd).toBe('bash');
    expect(calls[0].args[0].replace(/\\/g, '/')).toBe('install/update-native.sh');
    expect(calls[0].options.cwd).toBe('/repo-root');
    expect(calls[0].options.env.PROJECT_ROOT).toBe('/repo-root');
    expect(calls[0].options.env.RELEASE_TAG).toBe('v1.2.3');
    expect(calls[0].options.env.GIT_REPO_URL).toBe('https://github.com/org/repo.git');
    expect(String(calls[0].options.env.GIT_AUTH_HEADER || '').startsWith('AUTHORIZATION: basic ')).toBe(true);

    existsSyncSpy.mockRestore();
  });

  it('executeUpdate inicia job assincrono e retorna operationId', async () => {
    const { service, prismaMock, systemUpdateAdminServiceMock } = createService();

    const result = await service.executeUpdate({ version: 'v1.2.3' }, 'user-1', '127.0.0.1', 'jest');

    expect(result).toEqual({
      success: true,
      logId: 'log-1',
      operationId: 'update-123',
      status: 'starting',
      message: 'Update iniciado para versao v1.2.3.',
    });
    expect(systemUpdateAdminServiceMock.runUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 'v1.2.3',
        userId: 'user-1',
      }),
    );
    expect(prismaMock.updateLog.create).toHaveBeenCalled();
    expect(prismaMock.updateLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'log-1' },
      }),
    );
  });

  it('normalizeHttpStatus nao deixa exit code virar status HTTP', () => {
    const { service } = createService();

    expect(service.normalizeHttpStatus(50, 500)).toBe(500);
    expect(service.normalizeHttpStatus(500, 400)).toBe(500);
  });

  it('executeUpdate converte status invalido para 500 e preserva erro estruturado', async () => {
    const { service, prismaMock, systemUpdateAdminServiceMock } = createService();

    systemUpdateAdminServiceMock.runUpdate.mockRejectedValueOnce({
      message: 'healthcheck failed + rollback applied',
      status: 50,
      exitCode: 50,
    });

    try {
      await service.executeUpdate({ version: 'v1.2.3' }, 'user-1');
      throw new Error('expected executeUpdate to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      const httpError = error as HttpException;
      expect(httpError.getStatus()).toBe(500);
      expect(httpError.getResponse()).toMatchObject({
        code: 'UPDATE_UNEXPECTED_ERROR',
        exitCode: 50,
      });
    }

    expect(prismaMock.updateLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
        }),
      }),
    );
  });

  it('getUpdateStatus combina status persistido com lifecycle executando', async () => {
    const { service, systemUpdateAdminServiceMock } = createService();

    systemUpdateAdminServiceMock.getStatus.mockResolvedValueOnce({
      status: 'running',
      mode: 'native',
      startedAt: '2026-03-12T10:00:00.000Z',
      finishedAt: null,
      fromVersion: 'v1.0.0',
      toVersion: 'v1.2.3',
      step: 'healthcheck',
      progress: 82,
      lock: true,
      lastError: null,
      errorCode: null,
      errorCategory: null,
      errorStage: null,
      exitCode: null,
      userMessage: null,
      technicalMessage: null,
      rollback: {
        attempted: false,
        completed: false,
        reason: null,
      },
      operation: {
        active: true,
        operationId: 'update-123',
        type: 'update',
      },
      stale: false,
    });

    const status = await service.getUpdateStatus();

    expect(status.mode).toBe('native');
    expect(status.updateLifecycle).toMatchObject({
      status: 'restarting_services',
      step: 'healthcheck',
      progress: 82,
      operation: {
        active: true,
        operationId: 'update-123',
      },
    });
  });

  it('updateConfig persiste todos os campos expostos pela tela de updates', async () => {
    const { service, prismaMock } = createService();

    await service.updateConfig(
      {
        gitUsername: 'novo-org',
        gitRepository: 'novo-repo',
        gitReleaseBranch: 'stable',
        gitToken: '********',
        packageManager: 'docker',
        updateCheckEnabled: false,
        updateChannel: 'tag',
        releaseTag: 'v2.0.0',
        composeFile: 'docker-compose.custom.yml',
        envFile: 'install/.env.custom',
      },
      'user-1',
    );

    expect(prismaMock.updateSystemSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'settings-1' },
        data: expect.objectContaining({
          gitUsername: 'novo-org',
          gitRepository: 'novo-repo',
          gitReleaseBranch: 'stable',
          packageManager: 'docker',
          updateCheckEnabled: false,
          updateChannel: 'tag',
          releaseTag: 'v2.0.0',
          composeFile: 'docker-compose.custom.yml',
          envFile: 'install/.env.custom',
          updatedBy: 'user-1',
        }),
      }),
    );
  });

  it('updateConfig faz fallback para SQL bruto quando o Prisma encontra coluna ausente', async () => {
    const { service, prismaMock } = createService();
    const missingColumnError = new Prisma.PrismaClientKnownRequestError(
      'The column `update_system_settings.updateChannel` does not exist in the current database.',
      {
        code: 'P2022',
        clientVersion: '6.19.2',
      },
    );

    prismaMock.updateSystemSettings.update.mockRejectedValueOnce(missingColumnError);
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { column_name: 'id' },
      { column_name: 'gitUsername' },
      { column_name: 'gitRepository' },
      { column_name: 'gitReleaseBranch' },
      { column_name: 'packageManager' },
      { column_name: 'updateCheckEnabled' },
      { column_name: 'updatedAt' },
      { column_name: 'updatedBy' },
    ]);

    await service.updateConfig(
      {
        gitUsername: 'legacy-org',
        gitRepository: 'legacy-repo',
        gitReleaseBranch: 'main',
        gitToken: '********',
        packageManager: 'docker',
        updateCheckEnabled: true,
        updateChannel: 'release',
        releaseTag: 'latest',
        composeFile: 'docker-compose.prod.yml',
        envFile: 'install/.env.production',
      },
      'user-legacy',
    );

    expect(prismaMock.$executeRaw).toHaveBeenCalled();
  });
});
