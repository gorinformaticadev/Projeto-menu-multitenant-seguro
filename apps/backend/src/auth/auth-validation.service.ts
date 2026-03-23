import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@core/prisma/prisma.service';
import { TokenBlacklistService } from '../common/services/token-blacklist.service';
import { UserSessionService } from './user-session.service';
import { RequestSecurityContextService, SecurityActor } from '@common/services/request-security-context.service';

type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  tenantId: string | null;
  sessionVersion?: number;
  sid?: string;
  jti?: string;
};

type AuthValidationContext = {
  rawToken?: string;
  ipAddress?: string;
  userAgent?: string;
  expectedUserId?: string;
  expectedTenantId?: string | null;
  source?: 'http' | 'websocket' | 'service';
};

export type AuthenticatedSessionActor = SecurityActor & {
  id: string;
  email: string;
  role: string;
  tenantId: string | null;
  sessionId: string;
  sessionVersion: number;
};

@Injectable()
export class AuthValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tokenBlacklistService: TokenBlacklistService,
    private readonly userSessionService: UserSessionService,
    private readonly requestSecurityContext: RequestSecurityContextService,
  ) {}

  async validateAccessToken(
    token: string,
    context: AuthValidationContext = {},
  ): Promise<AuthenticatedSessionActor> {
    const normalizedToken = String(token || '').trim();
    if (!normalizedToken) {
      throw new UnauthorizedException('Token ausente');
    }

    const payload = this.jwtService.verify<JwtPayload>(normalizedToken, {
      secret: this.configService.get('JWT_SECRET'),
    });

    return this.validatePayload(payload, {
      ...context,
      rawToken: normalizedToken,
    });
  }

  async validatePayload(
    payload: JwtPayload,
    context: AuthValidationContext = {},
  ): Promise<AuthenticatedSessionActor> {
    const rawToken = typeof context.rawToken === 'string' ? context.rawToken.trim() : '';
    if (rawToken && (await this.tokenBlacklistService.isTokenBlacklisted(rawToken))) {
      throw new UnauthorizedException('Token revogado');
    }

    if (!payload?.sub) {
      throw new UnauthorizedException('Token invalido');
    }

    if (!payload.sid) {
      throw new UnauthorizedException('Sessao legada expirada; faca login novamente');
    }

    const user = await this.requestSecurityContext.runWithoutTenantEnforcement(
      'auth-validation:user-lookup',
      () =>
        this.prisma.user.findUnique({
          where: { id: payload.sub },
        }),
    );

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

    if (
      payload.role !== user.role ||
      payload.tenantId !== user.tenantId ||
      payload.email !== user.email
    ) {
      throw new UnauthorizedException('Token desatualizado');
    }

    if (context.expectedUserId && context.expectedUserId !== user.id) {
      throw new UnauthorizedException('Token nao pertence ao usuario esperado');
    }

    if (
      context.expectedTenantId !== undefined &&
      context.expectedTenantId !== user.tenantId
    ) {
      throw new UnauthorizedException('Token nao pertence ao tenant esperado');
    }

    await this.requestSecurityContext.runWithoutTenantEnforcement(
      'auth-validation:session-check',
      () =>
        this.userSessionService.assertAccessSessionActive(payload.sid!, user.id, {
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        }),
    );

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      name: user.name,
      sessionId: payload.sid,
      sessionVersion: currentSessionVersion,
    };
  }
}
