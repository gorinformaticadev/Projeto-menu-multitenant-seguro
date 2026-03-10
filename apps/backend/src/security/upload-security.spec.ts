import { BadRequestException, ForbiddenException } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  assertTenantUploadAccess,
  persistTenantUpload,
  resolveTenantUploadPath,
} from '../modules/ordem_servico/shared/utils/upload-security.util';

describe('Upload security boundaries', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ordem-servico-upload-'));
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
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
});
