import * as crypto from 'crypto';

export const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
export const CSRF_HEADER_NAME = 'X-CSRF-Token';
const CSRF_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function buildCsrfCookieOptions() {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/',
    maxAge: CSRF_COOKIE_MAX_AGE_MS,
  } as const;
}

export function ensureCsrfCookie(response: any, existingToken?: string | null): string {
  const reusableToken =
    typeof existingToken === 'string' && /^[a-f0-9]{64}$/i.test(existingToken.trim())
      ? existingToken.trim()
      : null;

  const token = reusableToken || crypto.randomBytes(32).toString('hex');

  response.cookie(CSRF_COOKIE_NAME, token, buildCsrfCookieOptions());

  return token;
}

export function clearCsrfCookie(response: any): void {
  response.cookie(CSRF_COOKIE_NAME, '', {
    ...buildCsrfCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });
}
