import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import * as sanitizeHtml from 'sanitize-html';

/**
 * Pipe para sanitização automática de inputs
 * Remove espaços em branco extras e previne injeções
 */
@Injectable()
export class SanitizationPipe implements PipeTransform {
  transform(value: unknown, _metadata: ArgumentMetadata) {
    return this.sanitizeValue(value);
  }

  private sanitizeValue(value: unknown): unknown {
    if (!value) {
      return value;
    }

    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeValue(item));
    }

    if (typeof value === 'object') {
      return this.sanitizeObject(value as Record<string, unknown>);
    }

    return value;
  }

  private sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        sanitized[key] = this.sanitizeValue(value);
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
