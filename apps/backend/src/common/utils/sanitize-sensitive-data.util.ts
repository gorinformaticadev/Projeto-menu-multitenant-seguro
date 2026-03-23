const SENSITIVE_KEY_PATTERN =
  /(token|secret|password|authorization|cookie|api[-_]?key|set-cookie|x-auth|x-access-token|x-refresh-token)/i;

const SENSITIVE_HEADER_PATTERN =
  /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|x-auth-token|x-access-token|x-refresh-token|x-csrf-token|x-xsrf-token)$/i;

export function sanitizeSensitiveData<T>(value: T): T {
  return sanitizeValue(value, 0, null) as T;
}

function sanitizeValue(value: unknown, depth: number, key: string | null): unknown {
  if (depth >= 5) {
    return '[truncated]';
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1, key));
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(childKey) || SENSITIVE_HEADER_PATTERN.test(childKey)) {
        result[childKey] = '[redacted]';
        continue;
      }

      result[childKey] = sanitizeValue(childValue, depth + 1, childKey);
    }
    return result;
  }

  if (typeof value === 'string') {
    if ((key && SENSITIVE_KEY_PATTERN.test(key)) || SENSITIVE_HEADER_PATTERN.test(key || '')) {
      return '[redacted]';
    }

    return value
      .replace(/\bBearer\s+[A-Za-z0-9\-._~+/=]+/gi, 'Bearer [redacted]')
      .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted-jwt]');
  }

  return value;
}
