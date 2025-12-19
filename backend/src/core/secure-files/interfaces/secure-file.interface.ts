/**
 * Interface para arquivo sensível
 */
export interface ISecureFile {
  id: string;
  tenantId: string;
  moduleName: string;
  documentType: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: bigint;
  uploadedBy: string;
  uploadedAt: Date;
  lastAccessedAt?: Date;
  accessCount: number;
  deletedAt?: Date;
  metadata?: string;
}

/**
 * Dados de resposta após upload
 */
export interface SecureFileUploadResponse {
  fileId: string;
  originalName: string;
  sizeBytes: number;
  uploadedAt: Date;
  moduleName: string;
  documentType: string;
}

/**
 * Dados de metadata do arquivo
 */
export interface SecureFileMetadata {
  fileId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
  lastAccessedAt?: Date;
  accessCount: number;
}

/**
 * Resultado de streaming de arquivo
 */
export interface SecureFileStream {
  stream: NodeJS.ReadableStream;
  headers: {
    'Content-Type': string;
    'Content-Length': number;
    'Content-Disposition': string;
    'Cache-Control': string;
  };
}
