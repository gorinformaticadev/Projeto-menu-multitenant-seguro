import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

/**
 * Utilitarios de seguranca para o sistema
 */

/**
 * Gera uma senha segura aleatoria
 */
export function generateSecurePassword(length: number = 16): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';

  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
  password += '0123456789'[Math.floor(Math.random() * 10)];
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)];

  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }

  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Gera uma chave criptografica segura
 */
export function generateSecureKey(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('base64');
}

/**
 * Valida se uma chave JWT e segura
 */
export function validateJWTSecret(secret: string): boolean {
  if (!secret || secret.length < 32) {
    return false;
  }

  const unsafeSecrets = [
    'sua-chave-secreta-super-segura-mude-em-producao-use-64-caracteres-ou-mais',
    'secret',
    'jwt-secret',
    'your-secret-key',
    'change-me',
    'default-secret',
  ];

  return !unsafeSecrets.includes(secret.toLowerCase());
}

export function validateSecuritySecret(secret: string): boolean {
  return validateJWTSecret(secret);
}

/**
 * Criptografa dados sensiveis usando AES-256-GCM
 * Formato de saida: iv:authTag:encryptedData (hex)
 */
export function encryptSensitiveData(data: string, key?: string): string {
  const encryptionKey = key || process.env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error('Chave de criptografia nao configurada');
  }

  const keyBuffer = crypto.createHash('sha256').update(encryptionKey).digest();
  const algorithm = 'aes-256-gcm';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Descriptografa dados sensiveis.
 * Suporta formato novo (GCM) e legado (CBC inseguro, apenas para leitura).
 */
export function decryptSensitiveData(encryptedData: string, key?: string): string {
  const encryptionKey = key || process.env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error('Chave de criptografia nao configurada');
  }

  const parts = encryptedData.split(':');

  if (parts.length === 3) {
    try {
      const [ivHex, authTagHex, encryptedHex] = parts;
      const keyBuffer = crypto.createHash('sha256').update(encryptionKey).digest();
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Falha ao descriptografar GCM:', (error as Error).message);
      throw new Error('Falha na descriptografia (GCM)');
    }
  }

  try {
    const partsLegacy = encryptedData.split(':');
    let encryptedLegacy = '';

    if (partsLegacy.length === 2) {
      encryptedLegacy = partsLegacy[1];
    } else {
      encryptedLegacy = encryptedData;
    }

    if (!encryptedLegacy) {
      throw new Error('Dados vazios');
    }

    const decipher = crypto.createDecipher('aes-256-cbc', encryptionKey);
    let decrypted = decipher.update(encryptedLegacy, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decriptografia falhou (Novo e Legado):', (error as Error).message);
    throw new Error('Falha na descriptografia dos dados');
  }
}

/**
 * Hash seguro de senha com salt aleatorio
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verifica se uma senha atende aos criterios de seguranca
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
  score: number;
} {
  const errors: string[] = [];
  let score = 0;

  if (password.length < 8) {
    errors.push('Senha deve ter pelo menos 8 caracteres');
  } else if (password.length >= 12) {
    score += 2;
  } else {
    score += 1;
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Senha deve conter pelo menos uma letra minuscula');
  } else {
    score += 1;
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Senha deve conter pelo menos uma letra maiuscula');
  } else {
    score += 1;
  }

  if (!/\d/.test(password)) {
    errors.push('Senha deve conter pelo menos um numero');
  } else {
    score += 1;
  }

  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('Senha deve conter pelo menos um caractere especial');
  } else {
    score += 1;
  }

  const commonPasswords = [
    'password',
    '123456',
    'admin',
    'admin123',
    'password123',
    'qwerty',
    'abc123',
    '123456789',
    'welcome',
    'login',
  ];

  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Senha muito comum, escolha uma senha mais segura');
    score = 0;
  }

  return {
    isValid: errors.length === 0,
    errors,
    score: Math.min(score, 5),
  };
}

/**
 * Gera um token seguro para reset de senha ou verificacao
 */
export function generateSecureToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Valida configuracoes de seguranca na inicializacao
 */
export function validateSecurityConfig(): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    errors.push('JWT_SECRET nao configurado');
  } else if (!validateJWTSecret(jwtSecret)) {
    errors.push('JWT_SECRET inseguro - deve ter pelo menos 32 caracteres e nao ser um valor padrao');
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    errors.push('ENCRYPTION_KEY nao configurado');
  } else if (encryptionKey.length < 32) {
    errors.push('ENCRYPTION_KEY deve ter pelo menos 32 caracteres');
  }

  const trustedDeviceSecret = process.env.TRUSTED_DEVICE_TOKEN_SECRET;
  if (!trustedDeviceSecret) {
    errors.push('TRUSTED_DEVICE_TOKEN_SECRET nao configurado');
  } else if (!validateSecuritySecret(trustedDeviceSecret)) {
    errors.push(
      'TRUSTED_DEVICE_TOKEN_SECRET inseguro - deve ter pelo menos 32 caracteres e nao ser um valor padrao',
    );
  } else if (trustedDeviceSecret === jwtSecret) {
    errors.push('TRUSTED_DEVICE_TOKEN_SECRET deve ser diferente de JWT_SECRET');
  }

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.HTTPS_ENABLED || process.env.HTTPS_ENABLED !== 'true') {
      warnings.push('HTTPS nao habilitado em producao');
    }

    if (!process.env.SENTRY_DSN) {
      warnings.push('Sentry nao configurado para monitoramento de erros');
    }

    if (process.env.LOG_LEVEL === 'debug') {
      warnings.push('Log level debug em producao pode expor informacoes sensiveis');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Sanitiza entrada do usuario para prevenir ataques
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .replace(/script/gi, '')
    .substring(0, 1000);
}
