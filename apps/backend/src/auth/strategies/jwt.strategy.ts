import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { PrismaService } from '@core/prisma/prisma.service';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { TokenBlacklistService } from '../../common/services/token-blacklist.service';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  tenantId: string | null;
  sessionVersion?: number;
  jti?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private tokenBlacklistService: TokenBlacklistService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
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
        : undefined;

    if (rawToken && (await this.tokenBlacklistService.isTokenBlacklisted(rawToken))) {
      throw new UnauthorizedException('Token revogado');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
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

    return {
      id: user.id,
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      name: user.name,
      sessionVersion: currentSessionVersion,
    };
  }
}
