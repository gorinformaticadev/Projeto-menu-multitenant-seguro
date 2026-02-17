import { UpdateService } from './update.service';

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
  return new UpdateService(prismaMock as any, auditMock as any);
}

describe('UpdateService', () => {
  it('repo publico sem token chama git ls-remote --tags', async () => {
    const service = createService();
    const calls: Array<{ cmd: string; args: string[] }> = [];

    (service as any).execFileAsync = jest.fn(async (cmd: string, args: string[]) => {
      calls.push({ cmd, args });
      return { stdout: 'hash\trefs/tags/v1.2.3\n', stderr: '' };
    });

    const out = await (service as any).getRemoteTagsOutput('https://github.com/org/repo.git');
    expect(out.includes('refs/tags/v1.2.3')).toBe(true);
    expect(calls.length).toBe(1);
    expect(calls[0].cmd).toBe('git');
    expect(calls[0].args).toEqual(['ls-remote', '--tags', 'https://github.com/org/repo.git']);
  });

  it('repo privado com token usa http.extraHeader Authorization basic', async () => {
    const service = createService();
    const calls: Array<{ cmd: string; args: string[] }> = [];

    (service as any).execFileAsync = jest.fn(async (cmd: string, args: string[]) => {
      calls.push({ cmd, args });
      return { stdout: 'hash\trefs/tags/v2.0.0\n', stderr: '' };
    });

    const encryptedToken = (service as any).encryptToken('my-secret-token');
    await (service as any).getRemoteTagsOutput('https://github.com/org/private.git', encryptedToken);

    expect(calls.length).toBe(1);
    expect(calls[0].cmd).toBe('git');
    expect(calls[0].args[0]).toBe('-c');
    expect(calls[0].args[1].startsWith('http.extraHeader=AUTHORIZATION: basic ')).toBe(true);
    expect(calls[0].args.slice(2)).toEqual(['ls-remote', '--tags', 'https://github.com/org/private.git']);
  });

  it('sanitizacao remove Authorization/basic e token', () => {
    const service = createService();
    const token = 'my-secret-token';
    const basic = Buffer.from(`x-access-token:${token}`, 'utf8').toString('base64');
    const input = `fatal: auth failed AUTHORIZATION: basic ${basic} token=${token}`;

    const out = (service as any).sanitizeGitError(input, token);
    expect(out.includes(token)).toBe(false);
    expect(out.includes(basic)).toBe(false);
    expect(out.includes('AUTHORIZATION: basic [REDACTED]')).toBe(true);
  });

  it('formatVersion normaliza para vX.Y.Z', () => {
    const service = createService();
    expect((service as any).formatVersion('1.2.3')).toBe('v1.2.3');
    expect((service as any).formatVersion('v1.2.3')).toBe('v1.2.3');
  });
});
