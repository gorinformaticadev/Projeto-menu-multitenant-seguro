import { Transform } from 'class-transformer';

/**
 * Decorator para remover espaços em branco
 */
export function Trim() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  });
}

/**
 * Decorator para converter para lowercase
 */
export function ToLowerCase() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase();
    }
    return value;
  });
}

/**
 * Decorator para converter para uppercase
 */
export function ToUpperCase() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toUpperCase();
    }
    return value;
  });
}

/**
 * Decorator para escapar HTML
 */
export function EscapeHtml() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }
    return value;
  });
}

/**
 * Decorator para remover tags HTML
 */
export function StripHtml() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.replace(/<[^>]*>/g, '');
    }
    return value;
  });
}

/**
 * Decorator para normalizar espaços
 */
export function NormalizeSpaces() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.replace(/\s+/g, ' ').trim();
    }
    return value;
  });
}
