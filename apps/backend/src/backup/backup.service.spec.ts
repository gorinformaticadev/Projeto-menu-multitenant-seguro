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
});
