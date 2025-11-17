import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

export const multerConfig = {
  storage: diskStorage({
    destination: './uploads/logos',
    filename: (req, file, callback) => {
      const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
      callback(null, uniqueName);
    },
  }),
  fileFilter: (req, file, callback) => {
    if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
      return callback(new Error('Apenas imagens são permitidas!'), false);
    }
    callback(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
};
