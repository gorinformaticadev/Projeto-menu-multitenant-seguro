import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { BadRequestException } from '@nestjs/common';
import { resolveTenantLogosDirPath } from '../paths/paths.service';

// Assinaturas de arquivos válidas (magic numbers)
const FILE_SIGNATURES = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/jpg': [0xFF, 0xD8, 0xFF],
  'image/pjpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/x-png': [0x89, 0x50, 0x4E, 0x47],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
  'image/gif': [0x47, 0x49, 0x46]
};

// Validar assinatura do arquivo
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

// Configurações dinâmicas a partir de variáveis de ambiente
const getMaxLogoFileSize = () => parseInt(process.env.MAX_LOGO_FILE_SIZE || '5242880', 10);
const getAllowedLogoMimeTypes = () => (
  process.env.ALLOWED_LOGO_MIME_TYPES || 'image/jpeg,image/jpg,image/pjpeg,image/png,image/x-png,image/webp,image/gif'
).split(',');

function resolveTenantIdFromRequest(req: any): string {
  const tenantIdFromParams = typeof req?.params?.id === 'string' ? req.params.id.trim() : '';
  if (tenantIdFromParams) {
    return tenantIdFromParams;
  }

  const tenantIdFromUser = typeof req?.user?.tenantId === 'string' ? req.user.tenantId.trim() : '';
  if (tenantIdFromUser) {
    return tenantIdFromUser;
  }

  throw new BadRequestException('Tenant invalido para upload de logo');
}

export const multerConfig = {
  storage: diskStorage({
    destination: (req, _file, callback) => {
      try {
        const tenantId = resolveTenantIdFromRequest(req);
        callback(null, resolveTenantLogosDirPath(tenantId));
      } catch (error) {
        callback(error as Error, '');
      }
    },
    filename: (req, file, callback) => {
      // Sanitizar nome do arquivo
      const sanitizedName = file.originalname
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .toLowerCase();
      
      const uniqueName = `${uuidv4()}_${sanitizedName}`;
      callback(null, uniqueName);
    },
  }),
  fileFilter: (req, file, callback) => {
    // Validação 1: MIME type (dinâmico via .env)
    const allowedMimeTypes = getAllowedLogoMimeTypes();
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return callback(new BadRequestException('Tipo de arquivo não permitido. Apenas JPEG, PNG, WebP e GIF são aceitos.'), false);
    }
    
    // Validação 2: Extensão do arquivo
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const fileExtension = extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      return callback(new BadRequestException('Extensão de arquivo não permitida.'), false);
    }
    
    // Validação 3: Nome do arquivo
    if (file.originalname.length > 255) {
      return callback(new BadRequestException('Nome do arquivo muito longo.'), false);
    }
    
    // Validação 4: Caracteres perigosos no nome
    const dangerousChars = /[<>:"/\\|?*]/;
    const hasControlChars = [...file.originalname].some((char) => char.charCodeAt(0) < 32);
    if (dangerousChars.test(file.originalname) || hasControlChars) {
      return callback(new BadRequestException('Nome do arquivo contém caracteres inválidos.'), false);
    }
    
    callback(null, true);
  },
  limits: {
    fileSize: getMaxLogoFileSize(), // Dinâmico via .env (padrão 5MB)
    files: 1, // Apenas 1 arquivo por vez
    fieldSize: 1024 * 1024, // 1MB para campos de texto
  },
};
