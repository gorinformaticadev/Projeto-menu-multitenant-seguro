import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { PrismaService } from '@core/prisma/prisma.service';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { TokenBlacklistService } from '../../common/services/token-blacklist.service';
import { UserSessionService } from '../user-session.service';
import { ACCESS_TOKEN_COOKIE_NAME } from '../auth-cookie.constants';
import { AuthSchemaCompatibilityService } from '../auth-schema-compatibility.service';

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
    private prisma: PrismaService,
    private tokenBlacklistService: TokenBlacklistService,
    private userSessionService: UserSessionService,
    private authSchemaCompatibilityService: AuthSchemaCompatibilityService,
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

    if (rawToken && (await this.tokenBlacklistService.isTokenBlacklisted(rawToken))) {
      throw new UnauthorizedException('Token revogado');
    }

    if (!payload.sid) {
      throw new UnauthorizedException('Sessao legada expirada; faca login novamente');
    }

    const capabilities = await this.authSchemaCompatibilityService.getCapabilities();
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        tenantId: true,
        name: true,
        ...(capabilities.hasSessionVersionColumn ? { sessionVersion: true } : {}),
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario nao encontrado');
    }

    const currentSessionVersion =
      typeof (user as { sessionVersion?: number | null }).sessionVersion === 'number'
        ? (user as { sessionVersion?: number | null }).sessionVersion
        : 0;

    if ((payload.sessionVersion ?? -1) !== currentSessionVersion) {
      throw new UnauthorizedException('Sessao expirada ou revogada');
    }

    if (payload.role !== user.role || payload.tenantId !== user.tenantId || payload.email !== user.email) {
      throw new UnauthorizedException('Token desatualizado');
    }

    await this.userSessionService.assertAccessSessionActive(payload.sid, user.id, {
      ipAddress: this.resolveClientIp(req),
      userAgent: this.resolveUserAgent(req),
    });

    return {
      id: user.id,
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      name: user.name,
      sessionVersion: currentSessionVersion,
      sid: payload.sid,
    };
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
