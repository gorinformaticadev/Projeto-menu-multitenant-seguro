import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@core/prisma/prisma.service';

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prismaService: PrismaService,
  ) {
      // Empty implementation
    }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client = context.switchToWs().getClient();
      const token = this.extractToken(client);
      
      if (!token) {
        this.logger.warn('Conexão WebSocket rejeitada: Nenhum token fornecido');
        return false;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      if (!payload.sub) {
        this.logger.warn('Conexão WebSocket rejeitada: Payload de token inválido');
        return false;
      }

      const user = await this.prismaService.user.findUnique({
        where: { id: payload.sub },
        include: { tenant: true }
      });

      if (!user) {
        this.logger.warn(`Conexão WebSocket rejeitada: Usuário não encontrado (${payload.sub})`);
        return false;
      }

      // Anexar contexto do usuário ao cliente
      client.user = {
        id: user.id,
        tenantId: user.tenantId,
        role: user.role,
        email: user.email,
        name: user.name
      };

      this.logger.log(`Autenticação WebSocket bem-sucedida: Usuário ${user.id} (${user.email})`);
      return true;

    } catch (error) {
      this.logger.error('Falha na autenticação WebSocket:', error.message);
      return false;
    }
  }

  private extractToken(client: unknown): string | null {
    return client.handshake?.auth?.token || 
           client.handshake?.headers?.authorization?.replace('Bearer ', '') ||
           null;
  }
}