import { CookieOptions } from 'express';

export const ACCESS_TOKEN_COOKIE_NAME = 'accessToken';
export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';
export const TWO_FACTOR_ENROLLMENT_COOKIE_NAME = 'two_factor_enrollment';

const isProduction = () => process.env.NODE_ENV === 'production';

const buildBaseCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: isProduction(),
  sameSite: 'lax',
  path: '/',
});

const resolveMaxAge = (expiresAt: Date): number => Math.max(expiresAt.getTime() - Date.now(), 0);

export const buildAccessTokenCookieOptions = (expiresAt: Date): CookieOptions => ({
  ...buildBaseCookieOptions(),
  maxAge: resolveMaxAge(expiresAt),
  expires: expiresAt,
});

export const buildRefreshTokenCookieOptions = (expiresAt: Date): CookieOptions => ({
  ...buildBaseCookieOptions(),
  maxAge: resolveMaxAge(expiresAt),
  expires: expiresAt,
});

export const buildTwoFactorEnrollmentCookieOptions = (expiresAt: Date): CookieOptions => ({
  ...buildBaseCookieOptions(),
  maxAge: resolveMaxAge(expiresAt),
  expires: expiresAt,
});

export const buildAuthCookieClearOptions = (): CookieOptions => ({
  ...buildBaseCookieOptions(),
  maxAge: 0,
  expires: new Date(0),
});
