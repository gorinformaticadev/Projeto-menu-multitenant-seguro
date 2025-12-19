import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Assinaturas de arquivos válidas (magic numbers)
 */
const FILE_SIGNATURES: Record<string, number[]> = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
  'image/gif': [0x47, 0x49, 0x46],
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  'application/zip': [0x50, 0x4B, 0x03, 0x04],
};

/**
 * Valida assinatura do arquivo
 */
export function validateFileSignature(buffer: Buffer, mimetype: string): boolean {
  const signature = FILE_SIGNATURES[mimetype];
  if (!signature) return false;

  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Sanitiza nome de arquivo
 */
export function sanitizeFileName(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .toLowerCase()
    .substring(0, 255); // Limite de 255 caracteres
}

/**
 * Configuração do Multer para uploads sensíveis
 * NOTA: O destino será definido dinamicamente no service
 */
export function getSecureMulterConfig(configService: ConfigService) {
  const maxSize = parseInt(
    configService.get<string>('MAX_SECURE_FILE_SIZE', '10485760'),
    10,
  );

  const allowedMimeTypes = configService
    .get<string>(
      'ALLOWED_SECURE_MIME_TYPES',
      'image/jpeg,image/png,image/webp,image/gif,application/pdf',
    )
    .split(',')
    .map((type) => type.trim());

  return {
    storage: diskStorage({
      destination: (req, file, callback) => {
        // O destino será definido dinamicamente pelo service
        // Aqui apenas retornamos um caminho temporário
        callback(null, './uploads/temp');
      },
      filename: (req, file, callback) => {
        // Gerar nome único com UUID
        const extension = extname(file.originalname);
        const uniqueName = `${uuidv4()}${extension}`;
        callback(null, uniqueName);
      },
    }),
    fileFilter: (req, file, callback) => {
      // Validação 1: MIME type
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return callback(
          new BadRequestException(
            `Tipo de arquivo não permitido: ${file.mimetype}. ` +
              `Tipos permitidos: ${allowedMimeTypes.join(', ')}`,
          ),
          false,
        );
      }

      callback(null, true);
    },
    limits: {
      fileSize: maxSize,
    },
  };
}

/**
 * Tipos MIME permitidos agrupados por categoria
 */
export const MIME_TYPE_CATEGORIES = {
  images: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  spreadsheets: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  archives: ['application/zip', 'application/x-rar-compressed'],
};

/**
 * Extensões permitidas por tipo MIME
 */
export const MIME_TYPE_EXTENSIONS: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/zip': ['.zip'],
  'application/x-rar-compressed': ['.rar'],
};
