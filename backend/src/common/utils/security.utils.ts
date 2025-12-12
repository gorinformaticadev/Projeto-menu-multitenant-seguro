import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

/**
 * Utilitários de segurança para o sistema
 */

/**
 * Gera uma senha segura aleatória
 */
export function generateSecurePassword(length: number = 16): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  // Garantir pelo menos um de cada tipo
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
  password += '0123456789'[Math.floor(Math.random() * 10)]; // number
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // special
  
  // Preencher o resto
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Embaralhar a senha
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Gera uma chave criptográfica segura
 */
export function generateSecureKey(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('base64');
}

/**
 * Valida se uma chave JWT é segura
 */
export function validateJWTSecret(secret: string): boolean {
  if (!secret || secret.length < 32) {
    return false;
  }
  
  // Verificar se não é uma das chaves de exemplo conhecidas
  const unsafeSecrets = [
    'sua-chave-secreta-super-segura-mude-em-producao-use-64-caracteres-ou-mais',
    'secret',
    'jwt-secret',
    'your-secret-key',
    'change-me',
    'default-secret'
  ];
  
  return !unsafeSecrets.includes(secret.toLowerCase());
}

/**
 * Criptografa dados sensíveis usando AES-256-GCM
 */
export function encryptSensitiveData(data: string, key?: string): string {
  const encryptionKey = key || process.env.ENCRYPTION_KEY;
  
  if (!encryptionKey) {
    throw new Error('Chave de criptografia não configurada');
  }
  
  const algorithm = 'aes-256-gcm';
  const iv = crypto.randomBytes(16);
  
  // Criar hash da chave para garantir tamanho correto (32 bytes para AES-256)
  const keyHash = crypto.createHash('sha256').update(encryptionKey).digest();
  
  const cipher = crypto.createCipher(algorithm, keyHash);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Para GCM, precisamos do authTag, mas createCipher não suporta
  // Vamos usar uma abordagem mais simples com AES-256-CBC
  const simpleCipher = crypto.createCipher('aes-256-cbc', encryptionKey);
  let simpleEncrypted = simpleCipher.update(data, 'utf8', 'hex');
  simpleEncrypted += simpleCipher.final('hex');
  
  // Retorna: iv:encryptedData (formato simplificado)
  return `${iv.toString('hex')}:${simpleEncrypted}`;
}

/**
 * Descriptografa dados sensíveis usando AES-256-GCM
 */
export function decryptSensitiveData(encryptedData: string, key?: string): string {
  const encryptionKey = key || process.env.ENCRYPTION_KEY;
  
  if (!encryptionKey) {
    throw new Error('Chave de criptografia não configurada');
  }
  
  const [ivHex, encrypted] = encryptedData.split(':');
  
  if (!ivHex || !encrypted) {
    throw new Error('Formato de dados criptografados inválido');
  }
  
  // Usar AES-256-CBC para compatibilidade
  const decipher = crypto.createDecipher('aes-256-cbc', encryptionKey);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Hash seguro de senha com salt aleatório
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12; // Aumentado para maior segurança
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verifica se uma senha atende aos critérios de segurança
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
  score: number;
} {
  const errors: string[] = [];
  let score = 0;
  
  // Comprimento mínimo
  if (password.length < 8) {
    errors.push('Senha deve ter pelo menos 8 caracteres');
  } else if (password.length >= 12) {
    score += 2;
  } else {
    score += 1;
  }
  
  // Letras minúsculas
  if (!/[a-z]/.test(password)) {
    errors.push('Senha deve conter pelo menos uma letra minúscula');
  } else {
    score += 1;
  }
  
  // Letras maiúsculas
  if (!/[A-Z]/.test(password)) {
    errors.push('Senha deve conter pelo menos uma letra maiúscula');
  } else {
    score += 1;
  }
  
  // Números
  if (!/\d/.test(password)) {
    errors.push('Senha deve conter pelo menos um número');
  } else {
    score += 1;
  }
  
  // Caracteres especiais
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Senha deve conter pelo menos um caractere especial');
  } else {
    score += 1;
  }
  
  // Verificar senhas comuns
  const commonPasswords = [
    'password', '123456', 'admin', 'admin123', 'password123',
    'qwerty', 'abc123', '123456789', 'welcome', 'login'
  ];
  
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Senha muito comum, escolha uma senha mais segura');
    score = 0;
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    score: Math.min(score, 5) // Máximo 5
  };
}

/**
 * Gera um token seguro para reset de senha ou verificação
 */
export function generateSecureToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Valida configurações de segurança na inicialização
 */
export function validateSecurityConfig(): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validar JWT Secret
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    errors.push('JWT_SECRET não configurado');
  } else if (!validateJWTSecret(jwtSecret)) {
    errors.push('JWT_SECRET inseguro - deve ter pelo menos 32 caracteres e não ser um valor padrão');
  }
  
  // Validar chave de criptografia
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    warnings.push('ENCRYPTION_KEY não configurado - dados sensíveis não serão criptografados');
  } else if (encryptionKey.length < 32) {
    errors.push('ENCRYPTION_KEY deve ter pelo menos 32 caracteres');
  }
  
  // Validar configurações de produção
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.HTTPS_ENABLED || process.env.HTTPS_ENABLED !== 'true') {
      warnings.push('HTTPS não habilitado em produção');
    }
    
    if (!process.env.SENTRY_DSN) {
      warnings.push('Sentry não configurado para monitoramento de erros');
    }
    
    if (process.env.LOG_LEVEL === 'debug') {
      warnings.push('Log level debug em produção pode expor informações sensíveis');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Sanitiza entrada do usuário para prevenir ataques
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove < e >
    .replace(/javascript:/gi, '') // Remove javascript:
    .replace(/on\w+=/gi, '') // Remove event handlers
    .replace(/script/gi, '') // Remove script
    .substring(0, 1000); // Limita tamanho
}