import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

/**
 * Pipe para sanitização automática de inputs
 * Remove espaços em branco extras e previne injeções
 */
@Injectable()
export class SanitizationPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (!value) return value;

    // Se for objeto, sanitiza recursivamente
    if (typeof value === 'object' && !Array.isArray(value)) {
      return this.sanitizeObject(value);
    }

    // Se for array, sanitiza cada item
    if (Array.isArray(value)) {
      return value.map((item) => this.transform(item, metadata));
    }

    // Se for string, sanitiza
    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }

    return value;
  }

  private sanitizeObject(obj: any): any {
    const sanitized: any = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];

        if (typeof value === 'string') {
          sanitized[key] = this.sanitizeString(value);
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = this.sanitizeObject(value);
        } else {
          sanitized[key] = value;
        }
      }
    }

    return sanitized;
  }

  private sanitizeString(str: string): string {
    // Remove espaços em branco no início e fim
    let sanitized = str.trim();

    // Remove múltiplos espaços consecutivos
    sanitized = sanitized.replace(/\s+/g, ' ');

    // Remove caracteres de controle perigosos
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return sanitized;
  }
}
