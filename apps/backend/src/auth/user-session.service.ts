import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { SecurityRuntimeConfigService } from '@core/security-config/security-runtime-config.service';

type SessionContext = {
  ipAddress?: string;
  userAgent?: string;
};

type SessionPolicySnapshot = {
  timeoutMinutes: number;
};

@Injectable()
export class UserSessionService {
  private readonly logger = new Logger(UserSessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly securityRuntimeConfigService: SecurityRuntimeConfigService,
  ) {}

  async createSession(
    userId: string,
    tenantId: string | null,
    context: SessionContext = {},
  ) {
    const now = new Date();
    const policy = await this.getSessionPolicy();

    return this.prisma.userSession.create({
      data: {
        userId,
        tenantId,
        lastActivityAt: now,
        lastAuthenticatedAt: now,
        expiresAt: this.calculateSessionExpiresAt(now, policy.timeoutMinutes),
        lastIpAddress: context.ipAddress || null,
        lastUserAgent: context.userAgent || null,
      },
    });
  }

  async assertAccessSessionActive(
    sessionId: string,
    userId: string,
    context: SessionContext = {},
  ) {
    const session = await this.getSessionOrThrow(sessionId, userId);
    const policy = await this.getSessionPolicy();
    const now = new Date();

    if (this.isSessionExpired(session, policy.timeoutMinutes, now)) {
      await this.revokeSession(session.id, 'inactive_timeout');
      this.logger.warn(
        `session_inactive_expired sessionId=${session.id} userId=${userId} timeoutMinutes=${policy.timeoutMinutes}`,
      );
      throw new UnauthorizedException('Sessao expirada por inatividade');
    }

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        lastActivityAt: now,
        expiresAt: this.calculateSessionExpiresAt(now, policy.timeoutMinutes),
        lastIpAddress: context.ipAddress || session.lastIpAddress,
        lastUserAgent: context.userAgent || session.lastUserAgent,
      },
    });

    return session;
  }

  async assertRefreshSessionActive(sessionId: string, userId: string) {
    const session = await this.getSessionOrThrow(sessionId, userId);
    const policy = await this.getSessionPolicy();
    const now = new Date();

    if (this.isSessionExpired(session, policy.timeoutMinutes, now)) {
      await this.revokeSession(session.id, 'inactive_timeout');
      this.logger.warn(
        `session_inactive_expired_on_refresh sessionId=${session.id} userId=${userId} timeoutMinutes=${policy.timeoutMinutes}`,
      );
      throw new UnauthorizedException('Sessao expirada por inatividade');
    }

    return session;
  }

  async revokeSession(sessionId: string, reason: string) {
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.userSession.updateMany({
        where: {
          id: sessionId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          revokeReason: reason,
        },
      }),
      this.prisma.refreshToken.deleteMany({
        where: {
          sessionId,
        },
      }),
    ]);
  }

  async revokeAllUserSessions(userId: string, reason: string) {
    const now = new Date();

    const sessions = await this.prisma.userSession.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      select: {
        id: true,
      },
    });

    const sessionIds = sessions.map((session) => session.id);
    if (sessionIds.length === 0) {
      await this.prisma.refreshToken.deleteMany({
        where: { userId },
      });
      return;
    }

    await this.prisma.$transaction([
      this.prisma.userSession.updateMany({
        where: {
          id: { in: sessionIds },
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          revokeReason: reason,
        },
      }),
      this.prisma.refreshToken.deleteMany({
        where: {
          OR: [
            { userId },
            { sessionId: { in: sessionIds } },
          ],
        },
      }),
    ]);
  }

  private async getSessionOrThrow(sessionId: string, userId: string) {
    const session = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId || session.revokedAt) {
      throw new UnauthorizedException('Sessao expirada ou revogada');
    }

    return session;
  }

  async cleanupExpiredSessions() {
    const result = await this.prisma.userSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }

  private async getSessionPolicy(): Promise<SessionPolicySnapshot> {
    const policy = await this.securityRuntimeConfigService.getSessionPolicy();
    return {
      timeoutMinutes: policy.timeoutMinutes,
    };
  }

  private isSessionExpired(
    session: { lastActivityAt: Date; expiresAt: Date },
    timeoutMinutes: number,
    now: Date,
  ) {
    if (session.expiresAt.getTime() <= now.getTime()) {
      return true;
    }

    const inactiveSince = now.getTime() - session.lastActivityAt.getTime();
    return inactiveSince > timeoutMinutes * 60_000;
  }

  private calculateSessionExpiresAt(reference: Date, timeoutMinutes: number): Date {
    return new Date(reference.getTime() + timeoutMinutes * 60_000);
  }
}
