/**
 * Utilitários para validação e formatação de CPF e CNPJ
 */

/**
 * Remove caracteres não numéricos
 */
export function cleanDocument(value: string): string {
  return value.replace(/[^\d]/g, '');
}

/**
 * Valida CPF
 */
export function isValidCPF(cpf: string): boolean {
  const cleanCPF = cleanDocument(cpf);

  // Verifica se tem 11 dígitos
  if (cleanCPF.length !== 11) return false;

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

  // Validação do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.charAt(9))) return false;

  // Validação do segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.charAt(10))) return false;

  return true;
}

/**
 * Valida CNPJ
 */
export function isValidCNPJ(cnpj: string): boolean {
  const cleanCNPJ = cleanDocument(cnpj);

  // Verifica se tem 14 dígitos
  if (cleanCNPJ.length !== 14) return false;

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{13}$/.test(cleanCNPJ)) return false;

  // Validação do primeiro dígito verificador
  let sum = 0;
  let weight = 2;
  for (let i = 11; i >= 0; i--) {
    sum += parseInt(cleanCNPJ.charAt(i)) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  let remainder = sum % 11;
  const firstDigit = remainder < 2 ? 0 : 11 - remainder;
  if (firstDigit !== parseInt(cleanCNPJ.charAt(12))) return false;

  // Validação do segundo dígito verificador
  sum = 0;
  weight = 2;
  for (let i = 12; i >= 0; i--) {
    sum += parseInt(cleanCNPJ.charAt(i)) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  remainder = sum % 11;
  const secondDigit = remainder < 2 ? 0 : 11 - remainder;
  if (secondDigit !== parseInt(cleanCNPJ.charAt(13))) return false;

  return true;
}

/**
 * Valida CPF ou CNPJ
 */
export function isValidCPFOrCNPJ(value: string): boolean {
  const cleanValue = cleanDocument(value);
  
  if (cleanValue.length === 11) {
    return isValidCPF(cleanValue);
  } else if (cleanValue.length === 14) {
    return isValidCNPJ(cleanValue);
  }
  
  return false;
}

/**
 * Formata CPF
 */
export function formatCPF(cpf: string): string {
  const cleanCPF = cleanDocument(cpf);
  if (cleanCPF.length !== 11) return cpf;
  
  return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formata CNPJ
 */
export function formatCNPJ(cnpj: string): string {
  const cleanCNPJ = cleanDocument(cnpj);
  if (cleanCNPJ.length !== 14) return cnpj;
  
  return cleanCNPJ.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/**
 * Formata CPF ou CNPJ automaticamente
 */
export function formatCPFOrCNPJ(value: string): string {
  const cleanValue = cleanDocument(value);
  
  if (cleanValue.length <= 11) {
    // Formata como CPF (parcial ou completo)
    if (cleanValue.length <= 3) return cleanValue;
    if (cleanValue.length <= 6) return cleanValue.replace(/(\d{3})(\d+)/, '$1.$2');
    if (cleanValue.length <= 9) return cleanValue.replace(/(\d{3})(\d{3})(\d+)/, '$1.$2.$3');
    return cleanValue.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
  } else {
    // Formata como CNPJ (parcial ou completo)
    if (cleanValue.length <= 2) return cleanValue;
    if (cleanValue.length <= 5) return cleanValue.replace(/(\d{2})(\d+)/, '$1.$2');
    if (cleanValue.length <= 8) return cleanValue.replace(/(\d{2})(\d{3})(\d+)/, '$1.$2.$3');
    if (cleanValue.length <= 12) return cleanValue.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, '$1.$2.$3/$4');
    return cleanValue.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, '$1.$2.$3/$4-$5');
  }
}

/**
 * Detecta o tipo de documento
 */
export function getDocumentType(value: string): 'cpf' | 'cnpj' | 'unknown' {
  const cleanValue = cleanDocument(value);
  
  if (cleanValue.length <= 11) {
    return 'cpf';
  } else if (cleanValue.length <= 14) {
    return 'cnpj';
  }
  
  return 'unknown';
}

/**
 * Obtém a máscara apropriada para o documento
 */
export function getDocumentMask(value: string): string {
  const type = getDocumentType(value);
  
  switch (type) {
    case 'cpf':
      return '999.999.999-99';
    case 'cnpj':
      return '99.999.999/9999-99';
    default:
      return '';
  }
}

/**
 * Valida e retorna mensagem de erro se inválido
 */
export function validateDocument(value: string): string | null {
  if (!value || value.trim() === '') {
    return 'Campo obrigatório';
  }

  const cleanValue = cleanDocument(value);
  
  if (cleanValue.length < 11) {
    return 'CPF deve ter 11 dígitos';
  }
  
  if (cleanValue.length > 11 && cleanValue.length < 14) {
    return 'CNPJ deve ter 14 dígitos';
  }
  
  if (cleanValue.length > 14) {
    return 'Documento inválido';
  }

  if (!isValidCPFOrCNPJ(value)) {
    const type = getDocumentType(value);
    return `${type.toUpperCase()} inválido`;
  }

  return null;
}