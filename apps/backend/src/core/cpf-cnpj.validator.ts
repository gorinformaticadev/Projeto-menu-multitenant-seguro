import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

/**
 * Valida CPF
 */
export function isValidCPF(cpf: string): boolean {
  // Remove caracteres não numéricos
  cpf = cpf.replace(/[^\d]/g, '');

  // Verifica se tem 11 dígitos
  if (cpf.length !== 11) return false;

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  // Validação do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.charAt(9))) return false;

  // Validação do segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.charAt(10))) return false;

  return true;
}

/**
 * Valida CNPJ
 */
export function isValidCNPJ(cnpj: string): boolean {
  // Remove caracteres não numéricos
  cnpj = cnpj.replace(/[^\d]/g, '');

  // Verifica se tem 14 dígitos
  if (cnpj.length !== 14) return false;

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  // Validação do primeiro dígito verificador
  let sum = 0;
  let weight = 2;
  for (let i = 11; i >= 0; i--) {
    sum += parseInt(cnpj.charAt(i)) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  let remainder = sum % 11;
  const firstDigit = remainder < 2 ? 0 : 11 - remainder;
  if (firstDigit !== parseInt(cnpj.charAt(12))) return false;

  // Validação do segundo dígito verificador
  sum = 0;
  weight = 2;
  for (let i = 12; i >= 0; i--) {
    sum += parseInt(cnpj.charAt(i)) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  remainder = sum % 11;
  const secondDigit = remainder < 2 ? 0 : 11 - remainder;
  if (secondDigit !== parseInt(cnpj.charAt(13))) return false;

  return true;
}

/**
 * Valida CPF ou CNPJ
 */
export function isValidCPFOrCNPJ(value: string): boolean {
  const cleanValue = value.replace(/[^\d]/g, '');
  
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
  const cleanCPF = cpf.replace(/[^\d]/g, '');
  if (cleanCPF.length !== 11) return cpf;
  
  return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formata CNPJ
 */
export function formatCNPJ(cnpj: string): string {
  const cleanCNPJ = cnpj.replace(/[^\d]/g, '');
  if (cleanCNPJ.length !== 14) return cnpj;
  
  return cleanCNPJ.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/**
 * Formata CPF ou CNPJ automaticamente
 */
export function formatCPFOrCNPJ(value: string): string {
  const cleanValue = value.replace(/[^\d]/g, '');
  
  if (cleanValue.length === 11) {
    return formatCPF(cleanValue);
  } else if (cleanValue.length === 14) {
    return formatCNPJ(cleanValue);
  }
  
  return value;
}

/**
 * Decorator para validação de CPF ou CNPJ
 */
export function IsValidCPFOrCNPJ(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidCPFOrCNPJ',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (typeof value !== 'string') return false;
          return isValidCPFOrCNPJ(value);
        },
        defaultMessage(args: ValidationArguments) {
          return 'CPF ou CNPJ inválido';
        },
      },
    });
  };
}

/**
 * Decorator para validação específica de CPF
 */
export function IsValidCPF(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidCPF',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (typeof value !== 'string') return false;
          return isValidCPF(value);
        },
        defaultMessage(args: ValidationArguments) {
          return 'CPF inválido';
        },
      },
    });
  };
}

/**
 * Decorator para validação específica de CNPJ
 */
export function IsValidCNPJ(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidCNPJ',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (typeof value !== 'string') return false;
          return isValidCNPJ(value);
        },
        defaultMessage(args: ValidationArguments) {
          return 'CNPJ inválido';
        },
      },
    });
  };
}