import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { SecurityRuntimeConfigService } from '@core/security-config/security-runtime-config.service';

type SessionContext = {
  ipAddress?: string;
  userAgent?: string;
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

    return this.prisma.userSession.create({
      data: {
        userId,
        tenantId,
        lastActivityAt: now,
        lastAuthenticatedAt: now,
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
    const timeoutMinutes = await this.getTimeoutMinutes();

    if (this.isInactive(session.lastActivityAt, timeoutMinutes)) {
      await this.revokeSession(session.id, 'inactive_timeout');
      this.logger.warn(
        `session_inactive_expired sessionId=${session.id} userId=${userId} timeoutMinutes=${timeoutMinutes}`,
      );
      throw new UnauthorizedException('Sessao expirada por inatividade');
    }

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        lastActivityAt: new Date(),
        lastIpAddress: context.ipAddress || session.lastIpAddress,
        lastUserAgent: context.userAgent || session.lastUserAgent,
      },
    });

    return session;
  }

  async assertRefreshSessionActive(sessionId: string, userId: string) {
    const session = await this.getSessionOrThrow(sessionId, userId);
    const timeoutMinutes = await this.getTimeoutMinutes();

    if (this.isInactive(session.lastActivityAt, timeoutMinutes)) {
      await this.revokeSession(session.id, 'inactive_timeout');
      this.logger.warn(
        `session_inactive_expired_on_refresh sessionId=${session.id} userId=${userId} timeoutMinutes=${timeoutMinutes}`,
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

  private async getTimeoutMinutes() {
    const policy = await this.securityRuntimeConfigService.getSessionPolicy();
    return policy.timeoutMinutes;
  }

  private isInactive(lastActivityAt: Date, timeoutMinutes: number) {
    const inactiveSince = Date.now() - lastActivityAt.getTime();
    return inactiveSince > timeoutMinutes * 60_000;
  }
}
