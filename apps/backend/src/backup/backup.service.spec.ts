import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BackupArtifactSource } from '@prisma/client';
import { BackupService } from './backup.service';

describe('BackupService', () => {
  it('valida upload dump com assinatura PGDMP', () => {
    const service = Object.create(BackupService.prototype) as BackupService;
    (service as any).archiveMagic = Buffer.from('PGDMP', 'ascii');
    (service as any).backupConfig = {
      getAllowedExtensions: () => ['.dump', '.backup'],
      getMaxUploadBytes: () => 1024 * 1024,
    };

    const file = {
      originalname: 'meu_backup.dump',
      size: 128,
      buffer: Buffer.concat([Buffer.from('PGDMP'), Buffer.alloc(123)]),
    } as Express.Multer.File;

    expect(() => (service as any).validateUploadedBackup(file)).not.toThrow();
  });

  it('rejeita upload com extensao invalida', () => {
    const service = Object.create(BackupService.prototype) as BackupService;
    (service as any).archiveMagic = Buffer.from('PGDMP', 'ascii');
    (service as any).backupConfig = {
      getAllowedExtensions: () => ['.dump', '.backup'],
      getMaxUploadBytes: () => 1024 * 1024,
    };

    const file = {
      originalname: 'arquivo.sql',
      size: 128,
      buffer: Buffer.concat([Buffer.from('PGDMP'), Buffer.alloc(123)]),
    } as Express.Multer.File;

    expect(() => (service as any).validateUploadedBackup(file)).toThrow('Extensao invalida');
  });

  it('bloqueia restore cross-environment sem forceCrossEnvironment', () => {
    const service = Object.create(BackupService.prototype) as BackupService;
    (service as any).backupConfig = {
      getEnvironmentScope: () => 'prod-cluster/db-main',
      getBackupDir: () => '/tmp/backups',
    };

    jest.spyOn<any, any>(service as any, 'assertSafeFilePath').mockImplementation(() => undefined);
    jest.spyOn<any, any>(service as any, 'toJsonRecord').mockImplementation((input: any) => input);

    const artifact: any = {
      source: BackupArtifactSource.BACKUP,
      filePath: '/tmp/backups/test.dump',
      metadata: {
        environmentScope: 'staging-cluster/db-main',
      },
    };

    expect(() =>
      (service as any).assertArtifactUsableForRestore(artifact, {
        forceCrossEnvironment: false,
      }),
    ).toThrow('Backup pertence a outro escopo de ambiente');
  });

  it('detecta objetos bloqueados em lista de restore', () => {
    const service = Object.create(BackupService.prototype) as BackupService;
    const lines = [
      '; Comment',
      '123; 1255 2200 FUNCTION public evil_user postgres',
      '124; 1259 2201 TABLE public users postgres',
    ];

    const blocked = (service as any).findBlockedEntriesFromRestoreList(lines, ['FUNCTION', 'EXTENSION']);
    expect(blocked).toHaveLength(1);
    expect(blocked[0]).toContain('FUNCTION');
  });

  it('bloqueia restore de upload com objetos perigosos quando allowUnsafeObjects=false', async () => {
    const service = Object.create(BackupService.prototype) as BackupService;
    (service as any).backupConfig = {
      getProtectedTablesForRestore: () => [],
      isStrictUploadRestoreInspectionEnabled: () => true,
      isDangerousObjectInspectionEnabled: () => true,
      getUploadRestoreBlockedObjectTypes: () => ['FUNCTION'],
      getBinary: () => 'pg_restore',
      getJobTimeoutMs: () => 2000,
      getProjectRoot: () => process.cwd(),
    };
    (service as any).processService = {
      runCommand: jest.fn().mockResolvedValue({
        stdout: '123; 1255 2200 FUNCTION public evil_user postgres',
      }),
    };
    jest.spyOn(service as any, 'tryAppendJobLog').mockResolvedValue(undefined);

    await expect(
      (service as any).buildFilteredRestoreList({
        dumpPath: '/tmp/upload.dump',
        jobId: 'job-1',
        password: 'secret',
        artifactSource: BackupArtifactSource.UPLOAD,
        allowUnsafeObjects: false,
      }),
    ).rejects.toThrow('Dump de upload bloqueado');
  });

  it('permite restore de upload com allowUnsafeObjects=true', async () => {
    const service = Object.create(BackupService.prototype) as BackupService;
    (service as any).backupConfig = {
      getProtectedTablesForRestore: () => [],
      isStrictUploadRestoreInspectionEnabled: () => true,
      isDangerousObjectInspectionEnabled: () => true,
      getUploadRestoreBlockedObjectTypes: () => ['FUNCTION'],
      getBinary: () => 'pg_restore',
      getJobTimeoutMs: () => 2000,
      getProjectRoot: () => process.cwd(),
    };
    (service as any).processService = {
      runCommand: jest.fn().mockResolvedValue({
        stdout: '123; 1255 2200 FUNCTION public evil_user postgres',
      }),
    };
    const logSpy = jest.spyOn(service as any, 'tryAppendJobLog').mockResolvedValue(undefined);

    await expect(
      (service as any).buildFilteredRestoreList({
        dumpPath: '/tmp/upload.dump',
        jobId: 'job-2',
        password: 'secret',
        artifactSource: BackupArtifactSource.UPLOAD,
        allowUnsafeObjects: true,
      }),
    ).resolves.toBeUndefined();

    expect(logSpy).toHaveBeenCalledWith(
      'job-2',
      'WARN',
      expect.stringContaining('allowUnsafeObjects=true'),
    );
  });

  it('filtra tabela protegida e objetos derivados no restore list', async () => {
    const service = Object.create(BackupService.prototype) as BackupService;
    const restoreListContent = [
      '3558; 1259 17331 TABLE public.backup_artifacts us_28whapichat',
      '3559; 1259 17332 INDEX backup_artifacts_createdByUserId_idx us_28whapichat',
      '3560; 1259 17333 INDEX users_email_key us_28whapichat',
    ].join('\n');
    const listFilePath = path.join(os.tmpdir(), `restore_list_test_${Date.now()}.txt`);

    (service as any).backupConfig = {
      getProtectedTablesForRestore: () => ['backup_artifacts'],
      isStrictUploadRestoreInspectionEnabled: () => false,
      isDangerousObjectInspectionEnabled: () => false,
      getUploadRestoreBlockedObjectTypes: () => [],
      getBinary: () => 'pg_restore',
      getJobTimeoutMs: () => 2000,
      getProjectRoot: () => process.cwd(),
    };
    (service as any).processService = {
      runCommand: jest.fn().mockResolvedValue({
        stdout: restoreListContent,
      }),
    };

    jest.spyOn(service as any, 'resolveFilePath').mockReturnValue(listFilePath);
    jest.spyOn(service as any, 'tryAppendJobLog').mockResolvedValue(undefined);

    const generatedPath = await (service as any).buildFilteredRestoreList({
      dumpPath: '/tmp/restore.dump',
      jobId: 'job-protected',
      password: 'secret',
      artifactSource: BackupArtifactSource.BACKUP,
      allowUnsafeObjects: false,
    });

    expect(generatedPath).toBe(listFilePath);
    const generatedLines = fs.readFileSync(listFilePath, 'utf8').split(/\r?\n/);
    expect(generatedLines[0]?.startsWith('; ')).toBe(true);
    expect(generatedLines[1]?.startsWith('; ')).toBe(true);
    expect(generatedLines[2]?.startsWith('; ')).toBe(false);

    fs.unlinkSync(listFilePath);
  });

  it('reconcile caso C renomeia staging para active', async () => {
    const service = Object.create(BackupService.prototype) as BackupService;
    (service as any).logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const runPsqlCommand = jest
      .spyOn(service as any, 'runPsqlCommand')
      .mockResolvedValueOnce('restore_stage_job\nmenu_rollback_job\nCOPY 2\n')
      .mockResolvedValueOnce('');
    const terminateSpy = jest
      .spyOn(service as any, 'terminateDatabaseConnections')
      .mockResolvedValue(undefined);

    const result = await (service as any).reconcilePromotionState(
      'menu_active',
      'restore_stage_job',
      'menu_rollback_job',
      'secret',
      30_000,
    );

    expect(result).toBe('C');
    expect(terminateSpy).toHaveBeenCalledWith(
      ['menu_active', 'restore_stage_job', 'menu_rollback_job'],
      'secret',
      30_000,
    );
    expect(runPsqlCommand).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        database: 'postgres',
        sql: expect.stringContaining('ALTER DATABASE "restore_stage_job" RENAME TO "menu_active"'),
      }),
    );
  });

  it('reconcile caso A nao executa rename', async () => {
    const service = Object.create(BackupService.prototype) as BackupService;
    (service as any).logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const runPsqlCommand = jest
      .spyOn(service as any, 'runPsqlCommand')
      .mockResolvedValue('menu_active\nCOPY 1\n');
    const terminateSpy = jest
      .spyOn(service as any, 'terminateDatabaseConnections')
      .mockResolvedValue(undefined);

    const result = await (service as any).reconcilePromotionState(
      'menu_active',
      'restore_stage_job',
      'menu_rollback_job',
      'secret',
      30_000,
    );

    expect(result).toBe('A');
    expect(terminateSpy).not.toHaveBeenCalled();
    expect(runPsqlCommand).toHaveBeenCalledTimes(1);
  });

  it('reconcile caso E lanca erro operacional', async () => {
    const service = Object.create(BackupService.prototype) as BackupService;
    (service as any).logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    jest.spyOn(service as any, 'runPsqlCommand').mockResolvedValue('restore_stage_job\nCOPY 1\n');

    await expect(
      (service as any).reconcilePromotionState(
        'menu_active',
        'restore_stage_job',
        'menu_rollback_job',
        'secret',
        30_000,
      ),
    ).rejects.toThrow('Estado invalido de promocao detectado no reconciler');
  });

  it('lock falha 1x e reagenda job com attempts=1 e nextRunAt', async () => {
    const service = Object.create(BackupService.prototype) as BackupService;
    const now = new Date('2026-03-04T18:00:00.000Z');
    const nowMs = now.getTime();
    const updateMock = jest
      .fn()
      .mockResolvedValueOnce({ lockAttempts: 1 })
      .mockResolvedValueOnce({ id: 'job-1' });

    (service as any).backupConfig = {
      getLockMaxAttempts: () => 30,
      getLockBackoffBaseMs: () => 1000,
      getLockBackoffMaxMs: () => 30000,
    };
    (service as any).prisma = {
      backupJob: {
        update: updateMock,
      },
    };

    const appendSpy = jest.spyOn(service as any, 'appendJobLog').mockResolvedValue(undefined);
    const notifySpy = jest.spyOn(service as any, 'notifyFailure').mockResolvedValue(undefined);
    const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(nowMs);
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

    await (service as any).returnJobToPending('job-1', 'lock global ocupado');

    expect(updateMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'job-1' },
        data: { lockAttempts: { increment: 1 } },
      }),
    );
    expect(updateMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({
          status: 'PENDING',
          currentStep: 'WAITING_LOCK',
          nextRunAt: new Date(nowMs + 1000),
        }),
      }),
    );
    expect(appendSpy).toHaveBeenCalledWith(
      'job-1',
      'INFO',
      expect.stringContaining('Tentativa de lock 1/30'),
    );
    expect(notifySpy).not.toHaveBeenCalled();

    dateSpy.mockRestore();
    randomSpy.mockRestore();
  });

  it('lock falha ate o maximo e job vira FAILED', async () => {
    const service = Object.create(BackupService.prototype) as BackupService;
    const updateMock = jest
      .fn()
      .mockResolvedValueOnce({ lockAttempts: 3 })
      .mockResolvedValueOnce({ id: 'job-2' });

    (service as any).backupConfig = {
      getLockMaxAttempts: () => 3,
      getLockBackoffBaseMs: () => 1000,
      getLockBackoffMaxMs: () => 30000,
    };
    (service as any).prisma = {
      backupJob: {
        update: updateMock,
      },
    };

    const appendSpy = jest.spyOn(service as any, 'appendJobLog').mockResolvedValue(undefined);
    const notifySpy = jest.spyOn(service as any, 'notifyFailure').mockResolvedValue(undefined);

    await (service as any).returnJobToPending('job-2', 'lock global ocupado');

    expect(updateMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'job-2' },
        data: expect.objectContaining({
          status: 'FAILED',
          currentStep: 'FAILED',
          error: 'Nao foi possivel adquirir lock global apos 3 tentativas. Tente novamente.',
          nextRunAt: null,
        }),
      }),
    );
    expect(appendSpy).toHaveBeenCalledWith(
      'job-2',
      'ERROR',
      'Nao foi possivel adquirir lock global apos 3 tentativas. Tente novamente.',
    );
    expect(notifySpy).toHaveBeenCalledWith(
      'job-2',
      'Nao foi possivel adquirir lock global apos 3 tentativas. Tente novamente.',
    );
  });
});
