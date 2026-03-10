import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { memoryStorage, Options } from 'multer';
import * as path from 'path';
import {
  resolveCanonicalPaths,
  resolveTenantModuleAreaPath,
} from '@core/common/paths/paths.service';

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
const SAFE_SEGMENT_REGEX = /^[a-zA-Z0-9._-]+$/;
const INVALID_UPLOAD_NAME_REGEX = /[\\/\u0000-\u001f]/;
const ORDEM_SERVICO_UPLOAD_SEGMENT = ['modules', 'ordem_servico'] as const;
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

export type OrdemServicoUploadArea = 'clientes' | 'ordens' | 'produtos';

const IMAGE_TYPE_RULES: Record<
  string,
  {
    extensions: string[];
    signatures: Array<{
      offset: number;
      bytes: number[];
    }>;
  }
> = {
  'image/jpeg': {
    extensions: ['.jpg', '.jpeg'],
    signatures: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  },
  'image/jpg': {
    extensions: ['.jpg', '.jpeg'],
    signatures: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  },
  'image/pjpeg': {
    extensions: ['.jpg', '.jpeg'],
    signatures: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  },
  'image/png': {
    extensions: ['.png'],
    signatures: [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47] }],
  },
  'image/x-png': {
    extensions: ['.png'],
    signatures: [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47] }],
  },
  'image/webp': {
    extensions: ['.webp'],
    signatures: [
      { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
      { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
    ],
  },
  'image/gif': {
    extensions: ['.gif'],
    signatures: [
      { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] },
      { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] },
    ],
  },
};

export const ORDEM_SERVICO_UPLOAD_OPTIONS: Options = {
  storage: memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    const rule = IMAGE_TYPE_RULES[file.mimetype];

    if (!rule) {
      callback(new BadRequestException('Tipo de arquivo nao permitido') as any, false);
      return;
    }

    try {
      sanitizeOriginalUploadName(file.originalname || '');
    } catch (error) {
      callback(error as any, false);
      return;
    }

    callback(null, true);
  },
};

export function persistTenantUpload(baseDir: string, tenantId: string, file: Express.Multer.File) {
  const safeTenantId = sanitizeSegment(tenantId, 'tenant');
  const buffer = normalizeUploadedBuffer(file);
  const extension = validateUploadedImage(file, buffer);
  const tenantDir = path.resolve(baseDir, safeTenantId);

  fs.mkdirSync(tenantDir, { recursive: true });

  const fileName = `${Date.now()}-${randomUUID()}${extension}`;
  const filePath = path.join(tenantDir, fileName);
  fs.writeFileSync(filePath, buffer, { mode: 0o600 });

  return { fileName, filePath };
}

export function persistTenantModuleUpload(
  area: OrdemServicoUploadArea,
  tenantId: string,
  file: Express.Multer.File,
) {
  const tenantAreaDir = resolveTenantAreaRoot(area, tenantId);
  const buffer = normalizeUploadedBuffer(file);
  const extension = validateUploadedImage(file, buffer);
  const fileName = `${Date.now()}-${randomUUID()}${extension}`;
  const filePath = path.resolve(tenantAreaDir, fileName);

  fs.writeFileSync(filePath, buffer, { mode: 0o600 });
  return { fileName, filePath };
}

export function resolveTenantUploadPath(baseDir: string, tenantId: string, filename: string) {
  const safeTenantId = sanitizeSegment(tenantId, 'tenant');
  const safeFilename = sanitizeFilename(filename);
  const tenantDir = path.resolve(baseDir, safeTenantId);
  const resolvedPath = path.resolve(tenantDir, safeFilename);

  if (!resolvedPath.startsWith(`${tenantDir}${path.sep}`) && resolvedPath !== path.join(tenantDir, safeFilename)) {
    throw new ForbiddenException('Acesso negado');
  }

  return resolvedPath;
}

export function resolveTenantModuleUploadPath(
  area: OrdemServicoUploadArea,
  tenantId: string,
  filename: string,
) {
  const canonicalPath = resolveTenantUploadPath(resolveTenantAreaRoot(area, tenantId), '.', filename);

  if (fs.existsSync(canonicalPath)) {
    return canonicalPath;
  }

  const legacyModulePath = resolveTenantUploadPath(resolveLegacyModuleAreaRoot(area), tenantId, filename);
  if (fs.existsSync(legacyModulePath)) {
    return legacyModulePath;
  }

  if (area === 'produtos') {
    const legacyPath = resolveTenantUploadPath(resolveLegacyProductsRoot(), tenantId, filename);

    if (fs.existsSync(legacyPath)) {
      return legacyPath;
    }
  }

  return canonicalPath;
}

export function buildTenantModuleUploadUrl(
  area: OrdemServicoUploadArea,
  tenantId: string,
  fileName: string,
) {
  const safeArea = sanitizeUploadArea(area);
  const safeTenantId = sanitizeSegment(tenantId, 'tenant');
  const safeFileName = sanitizeFilename(fileName);

  return `/api/ordem_servico/${safeArea}/uploads/${safeTenantId}/${safeFileName}`;
}

export function assertTenantUploadAccess(requestTenantId: string, routeTenantId: string) {
  const safeRequestTenantId = sanitizeSegment(requestTenantId, 'tenant');
  const safeRouteTenantId = sanitizeSegment(routeTenantId, 'tenant');

  if (safeRequestTenantId !== safeRouteTenantId) {
    throw new ForbiddenException('Acesso negado');
  }
}

function validateUploadedImage(file: Express.Multer.File, buffer: Buffer) {
  const rule = IMAGE_TYPE_RULES[file.mimetype];
  sanitizeOriginalUploadName(file.originalname || '');

  if (!rule) {
    throw new BadRequestException('Tipo de arquivo nao permitido');
  }

  const signatureValid = rule.signatures.some((signature) =>
    signature.bytes.every((byte, index) => buffer[signature.offset + index] === byte),
  );

  if (!signatureValid) {
    throw new BadRequestException('Assinatura do arquivo invalida');
  }

  return rule.extensions[0];
}

function normalizeUploadedBuffer(file: Express.Multer.File): Buffer {
  let bufferData = file.buffer;

  if (bufferData && typeof bufferData === 'object' && !Buffer.isBuffer(bufferData)) {
    if ((bufferData as any).type === 'Buffer' && Array.isArray((bufferData as any).data)) {
      bufferData = Buffer.from((bufferData as any).data);
    } else {
      bufferData = Buffer.from(Object.values(bufferData) as number[]);
    }
  }

  if ((!bufferData || !Buffer.isBuffer(bufferData)) && file.path) {
    bufferData = fs.readFileSync(file.path);
  }

  if (!Buffer.isBuffer(bufferData) || bufferData.length === 0) {
    throw new BadRequestException('Arquivo invalido');
  }

  return bufferData;
}

function sanitizeSegment(value: string, label: string) {
  if (!value || !SAFE_SEGMENT_REGEX.test(value)) {
    throw new BadRequestException(`${label} invalido`);
  }

  return value;
}

function sanitizeOriginalUploadName(filename: string) {
  const normalizedFilename = String(filename || '').trim();

  if (!normalizedFilename || INVALID_UPLOAD_NAME_REGEX.test(normalizedFilename)) {
    throw new BadRequestException('Nome de arquivo invalido');
  }

  const extension = path.extname(path.basename(normalizedFilename)).toLowerCase();
  if (!extension || !ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    throw new BadRequestException('Extensao de arquivo nao permitida');
  }

  return normalizedFilename;
}

function sanitizeFilename(filename: string) {
  if (!filename || !SAFE_SEGMENT_REGEX.test(filename)) {
    throw new BadRequestException('Nome de arquivo invalido');
  }

  const extension = path.extname(filename).toLowerCase();
  const hasAllowedExtension = Object.values(IMAGE_TYPE_RULES).some((rule) =>
    rule.extensions.includes(extension),
  );

  if (!hasAllowedExtension) {
    throw new BadRequestException('Extensao de arquivo nao permitida');
  }

  return filename;
}

function sanitizeUploadArea(area: OrdemServicoUploadArea) {
  if (area !== 'clientes' && area !== 'ordens' && area !== 'produtos') {
    throw new BadRequestException('Area de upload invalida');
  }

  return area;
}

function resolveTenantAreaRoot(area: OrdemServicoUploadArea, tenantId: string) {
  const safeArea = sanitizeUploadArea(area);
  return resolveTenantModuleAreaPath(
    sanitizeSegment(tenantId, 'tenant'),
    ORDEM_SERVICO_UPLOAD_SEGMENT[1],
    safeArea,
  );
}

function resolveLegacyModuleAreaRoot(area: OrdemServicoUploadArea) {
  const safeArea = sanitizeUploadArea(area);
  const canonicalPaths = resolveCanonicalPaths();

  return path.resolve(canonicalPaths.uploadsDir, ...ORDEM_SERVICO_UPLOAD_SEGMENT, safeArea);
}

function resolveLegacyProductsRoot() {
  return path.resolve(resolveCanonicalPaths().uploadsDir, 'produtos');
}
