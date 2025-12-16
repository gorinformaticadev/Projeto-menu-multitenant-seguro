import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { BadRequestException } from '@nestjs/common';

// Assinaturas de arquivos válidas (magic numbers)
const FILE_SIGNATURES = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
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

export const multerConfig = {
  storage: diskStorage({
    destination: './uploads/logos',
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
    // Validação 1: MIME type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
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
    const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (dangerousChars.test(file.originalname)) {
      return callback(new BadRequestException('Nome do arquivo contém caracteres inválidos.'), false);
    }
    
    callback(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1, // Apenas 1 arquivo por vez
    fieldSize: 1024 * 1024, // 1MB para campos de texto
  },
};