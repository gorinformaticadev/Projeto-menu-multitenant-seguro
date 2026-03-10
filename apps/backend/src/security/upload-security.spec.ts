import { BadRequestException, ForbiddenException } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  assertTenantUploadAccess,
  buildTenantModuleUploadUrl,
  persistTenantModuleUpload,
  persistTenantUpload,
  resolveTenantModuleUploadPath,
  resolveTenantUploadPath,
} from '../modules/ordem_servico/shared/utils/upload-security.util';

describe('Upload security boundaries', () => {
  let tempRoot: string;
  let previousUploadsDir: string | undefined;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ordem-servico-upload-'));
    previousUploadsDir = process.env.UPLOADS_DIR;
    process.env.UPLOADS_DIR = tempRoot;
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    if (previousUploadsDir === undefined) {
      delete process.env.UPLOADS_DIR;
    } else {
      process.env.UPLOADS_DIR = previousUploadsDir;
    }
  });

  it('rejects files with a mismatched binary signature', () => {
    expect(() =>
      persistTenantUpload(tempRoot, 'tenant-1', {
        originalname: 'evidence.png',
        mimetype: 'image/png',
        buffer: Buffer.from('not-a-real-png', 'utf8'),
      } as Express.Multer.File),
    ).toThrow(BadRequestException);
  });

  it('rejects executable-looking file names before persisting', () => {
    expect(() =>
      persistTenantUpload(tempRoot, 'tenant-1', {
        originalname: 'payload.php',
        mimetype: 'image/png',
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      } as Express.Multer.File),
    ).toThrow(BadRequestException);
  });

  it('blocks tenant path traversal and cross-tenant file access', () => {
    expect(() => assertTenantUploadAccess('tenant-1', 'tenant-2')).toThrow(ForbiddenException);
    expect(() => resolveTenantUploadPath(tempRoot, 'tenant-1', '../evil.png')).toThrow(BadRequestException);
  });

  it('stores module uploads under the canonical ordem servico directory and normalizes jpeg extension', () => {
    const jpegBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x00, 0x00,
    ]);

    const persistedUpload = persistTenantModuleUpload('clientes', 'tenant-1', {
      originalname: 'avatar (1).png',
      mimetype: 'image/jpeg',
      buffer: jpegBuffer,
    } as Express.Multer.File);

    expect(persistedUpload.fileName).toMatch(/\.jpg$/);
    expect(persistedUpload.filePath).toContain(
      path.join('tenants', 'tenant-1', 'modules', 'ordem_servico', 'clientes'),
    );
    expect(fs.existsSync(persistedUpload.filePath)).toBe(true);
    expect(buildTenantModuleUploadUrl('clientes', 'tenant-1', persistedUpload.fileName)).toBe(
      `/api/ordem_servico/clientes/uploads/tenant-1/${persistedUpload.fileName}`,
    );
  });

  it('falls back to the legacy product directory for existing files', () => {
    const legacyTenantDir = path.join(tempRoot, 'produtos', 'tenant-1');
    const legacyFilePath = path.join(legacyTenantDir, 'legacy-photo.jpg');
    fs.mkdirSync(legacyTenantDir, { recursive: true });
    fs.writeFileSync(legacyFilePath, Buffer.from([0xff, 0xd8, 0xff]), { mode: 0o600 });

    expect(resolveTenantModuleUploadPath('produtos', 'tenant-1', 'legacy-photo.jpg')).toBe(
      legacyFilePath,
    );
  });
});
