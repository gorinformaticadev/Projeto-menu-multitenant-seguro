import { UpdateService } from './update.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

type UpdateServiceTestHandle = {
  execFileAsync: jest.Mock;
  getRemoteTagsOutput: (repoUrl: string, encryptedGitToken?: string) => Promise<string>;
  encryptToken: (token: string) => string;
  sanitizeGitError: (output: string, token?: string) => string;
  formatVersion: (version: string) => string;
};

function createService() {
  process.env.ENCRYPTION_KEY = '12345678901234567890123456789012-strong-key-material';
  const prismaMock = {
    systemSettings: {
      findFirst: async () => null,
      create: async () => ({}),
      update: async () => ({}),
    },
  };
  const auditMock = { log: async () => undefined };
  return new UpdateService(
    prismaMock as unknown as PrismaService,
    auditMock as unknown as AuditService,
  );
}

function asPrivateApi(service: UpdateService): UpdateServiceTestHandle {
  return service as unknown as UpdateServiceTestHandle;
}

describe('UpdateService', () => {
  it('repo publico sem token chama git ls-remote --tags', async () => {
    const service = asPrivateApi(createService());
    const calls: Array<{ cmd: string; args: string[] }> = [];

    service.execFileAsync = jest.fn(async (cmd: string, args: string[]) => {
      calls.push({ cmd, args });
      return { stdout: 'hash\trefs/tags/v1.2.3\n', stderr: '' };
    });

    const out = await service.getRemoteTagsOutput('https://github.com/org/repo.git');
    expect(out.includes('refs/tags/v1.2.3')).toBe(true);
    expect(calls.length).toBe(1);
    expect(calls[0].cmd).toBe('git');
    expect(calls[0].args).toEqual(['ls-remote', '--tags', 'https://github.com/org/repo.git']);
  });

  it('repo privado com token usa http.extraHeader Authorization basic', async () => {
    const service = asPrivateApi(createService());
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
    const service = asPrivateApi(createService());
    const token = 'my-secret-token';
    const basic = Buffer.from(`x-access-token:${token}`, 'utf8').toString('base64');
    const input = `fatal: auth failed AUTHORIZATION: basic ${basic} token=${token}`;

    const out = service.sanitizeGitError(input, token);
    expect(out.includes(token)).toBe(false);
    expect(out.includes(basic)).toBe(false);
    expect(out.includes('AUTHORIZATION: basic [REDACTED]')).toBe(true);
  });

  it('formatVersion normaliza para vX.Y.Z', () => {
    const service = asPrivateApi(createService());
    expect(service.formatVersion('1.2.3')).toBe('v1.2.3');
    expect(service.formatVersion('v1.2.3')).toBe('v1.2.3');
  });
});
