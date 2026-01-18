import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import * as sanitizeHtml from 'sanitize-html';

/**
 * Pipe para sanitização automática de inputs
 * Remove espaços em branco extras e previne injeções
 */
@Injectable()
export class SanitizationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
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
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
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

    // Sanitização robusta contra XSS usando sanitize-html
    // Remove tags HTML e atributos perigosos, mas mantém texto seguro
    sanitized = sanitizeHtml(sanitized, {
      allowedTags: [], // Remove TODAS as tags HTML
      allowedAttributes: {}, // Remove TODOS os atributos
      disallowedTagsMode: 'recursiveEscape', // Escapa o conteúdo das tags em vez de remover
    });

    return sanitized;
  }
}
