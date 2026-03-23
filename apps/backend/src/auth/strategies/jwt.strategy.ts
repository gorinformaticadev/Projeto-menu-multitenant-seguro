import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ACCESS_TOKEN_COOKIE_NAME } from '../auth-cookie.constants';
import { AuthValidationService } from '../auth-validation.service';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  tenantId: string | null;
  sessionVersion?: number;
  sid?: string;
  jti?: string;
}

const extractAccessTokenFromCookie = (req: Request): string | null => {
  const cookieValue = req?.cookies?.[ACCESS_TOKEN_COOKIE_NAME];
  return typeof cookieValue === 'string' && cookieValue.trim().length > 0
    ? cookieValue.trim()
    : null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config: ConfigService,
    private authValidationService: AuthValidationService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        extractAccessTokenFromCookie,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const authorization = req.headers?.authorization;
    const rawToken =
      typeof authorization === 'string' && authorization.toLowerCase().startsWith('bearer ')
        ? authorization.slice(7).trim()
        : extractAccessTokenFromCookie(req) || undefined;

    return this.authValidationService.validatePayload(payload, {
      rawToken,
      ipAddress: this.resolveClientIp(req),
      userAgent: this.resolveUserAgent(req),
      source: 'http',
    });
  }

  private resolveClientIp(req: Request): string | undefined {
    if (typeof req.ip === 'string' && req.ip.trim().length > 0) {
      return req.ip.trim();
    }

    const forwardedFor = req.headers['x-forwarded-for'];
    const firstForwarded = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    if (typeof firstForwarded === 'string' && firstForwarded.trim().length > 0) {
      return firstForwarded.split(',')[0].trim();
    }

    return undefined;
  }

  private resolveUserAgent(req: Request): string | undefined {
    const header = req.headers['user-agent'];
    const userAgent = Array.isArray(header) ? header[0] : header;
    return typeof userAgent === 'string' && userAgent.trim().length > 0
      ? userAgent.trim()
      : undefined;
  }
}
