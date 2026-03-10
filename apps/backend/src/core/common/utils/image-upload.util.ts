import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';
import { readFileSync } from 'fs';
import { extname } from 'path';

type SignaturePattern = {
  offset: number;
  bytes: number[];
};

type ImageSignatureRule = {
  extension: string;
  signatureVariants: SignaturePattern[][];
};

const IMAGE_SIGNATURE_RULES: Record<string, ImageSignatureRule> = {
  'image/jpeg': {
    extension: '.jpg',
    signatureVariants: [[{ offset: 0, bytes: [0xff, 0xd8, 0xff] }]],
  },
  'image/jpg': {
    extension: '.jpg',
    signatureVariants: [[{ offset: 0, bytes: [0xff, 0xd8, 0xff] }]],
  },
  'image/pjpeg': {
    extension: '.jpg',
    signatureVariants: [[{ offset: 0, bytes: [0xff, 0xd8, 0xff] }]],
  },
  'image/png': {
    extension: '.png',
    signatureVariants: [[{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47] }]],
  },
  'image/x-png': {
    extension: '.png',
    signatureVariants: [[{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47] }]],
  },
  'image/webp': {
    extension: '.webp',
    signatureVariants: [[
      { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
      { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
    ]],
  },
  'image/gif': {
    extension: '.gif',
    signatureVariants: [
      [{ offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }],
      [{ offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }],
    ],
  },
};

const SAFE_IMAGE_NAME_REGEX = /^[a-zA-Z0-9._\-\s()]+$/;
const INVALID_IMAGE_NAME_REGEX = /[<>:"/\\|?*]/;
const ALLOWED_IMAGE_EXTENSIONS = new Set<string>(
  Object.values(IMAGE_SIGNATURE_RULES).map((rule) => rule.extension),
);

export const DEFAULT_MAX_IMAGE_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

export function createImageMulterOptions(
  maxFileSizeBytes = DEFAULT_MAX_IMAGE_UPLOAD_SIZE_BYTES,
): MulterOptions {
  return {
    storage: memoryStorage(),
    limits: {
      fileSize: maxFileSizeBytes,
      files: 1,
    },
    fileFilter: (_req, file, callback) => {
      try {
        if (!IMAGE_SIGNATURE_RULES[file.mimetype]) {
          throw new BadRequestException('Tipo de arquivo nao permitido');
        }
        sanitizeOriginalImageName(file.originalname || '');
        callback(null, true);
      } catch (error) {
        callback(error as Error, false);
      }
    },
  };
}

export function validateUploadedImageBuffer(file: Express.Multer.File): {
  buffer: Buffer;
  extension: string;
} {
  const rule = IMAGE_SIGNATURE_RULES[file?.mimetype || ''];
  if (!rule) {
    throw new BadRequestException('Tipo de arquivo nao permitido');
  }

  sanitizeOriginalImageName(file.originalname || '');
  const buffer = normalizeUploadedBuffer(file);

  const hasValidSignature = rule.signatureVariants.some((variant) =>
    variant.every((pattern) =>
      pattern.bytes.every((byte, index) => buffer[pattern.offset + index] === byte),
    ),
  );

  if (!hasValidSignature) {
    throw new BadRequestException('Assinatura do arquivo invalida');
  }

  return {
    buffer,
    extension: rule.extension,
  };
}

export function sanitizeOriginalImageName(filename: string): string {
  const normalized = String(filename || '').trim();
  const hasControlChars = [...normalized].some((char) => char.charCodeAt(0) < 32);
  if (!normalized || INVALID_IMAGE_NAME_REGEX.test(normalized) || hasControlChars) {
    throw new BadRequestException('Nome de arquivo invalido');
  }

  if (!SAFE_IMAGE_NAME_REGEX.test(normalized)) {
    throw new BadRequestException('Nome de arquivo contem caracteres nao permitidos');
  }

  const extension = extname(normalized).toLowerCase();
  if (!extension || !ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    throw new BadRequestException('Extensao de arquivo nao permitida');
  }

  return normalized;
}

function normalizeUploadedBuffer(file: Express.Multer.File): Buffer {
  let bufferData: Buffer | null = Buffer.isBuffer(file?.buffer) ? file.buffer : null;
  const rawBuffer = file?.buffer as unknown;

  if (!bufferData && rawBuffer && typeof rawBuffer === 'object') {
    const typedBuffer = rawBuffer as { type?: string; data?: number[] } | Record<string, unknown>;

    if (
      'type' in typedBuffer &&
      typedBuffer.type === 'Buffer' &&
      'data' in typedBuffer &&
      Array.isArray(typedBuffer.data)
    ) {
      bufferData = Buffer.from(typedBuffer.data);
    } else {
      const numericValues = Object.values(typedBuffer)
        .filter((value): value is number => typeof value === 'number')
        .map((value) => Number(value));
      if (numericValues.length > 0) {
        bufferData = Buffer.from(numericValues);
      }
    }
  }

  if ((!bufferData || !Buffer.isBuffer(bufferData)) && file?.path) {
    bufferData = readFileSync(file.path);
  }

  if (!Buffer.isBuffer(bufferData) || bufferData.length === 0) {
    throw new BadRequestException('Arquivo invalido');
  }

  return bufferData;
}
