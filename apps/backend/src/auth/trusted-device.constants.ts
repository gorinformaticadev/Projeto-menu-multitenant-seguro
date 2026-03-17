import { CookieOptions } from 'express';

export const TRUSTED_DEVICE_COOKIE_NAME = 'trusted_device';
export const TRUSTED_DEVICE_TTL_DAYS = 30;
export const TRUSTED_DEVICE_TTL_MS = TRUSTED_DEVICE_TTL_DAYS * 24 * 60 * 60 * 1000;

export const buildTrustedDeviceCookieOptions = (expiresAt: Date): CookieOptions => {
  const maxAge = Math.max(expiresAt.getTime() - Date.now(), 0);

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
    expires: expiresAt,
  };
};

export const buildTrustedDeviceCookieClearOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 0,
  expires: new Date(0),
});
