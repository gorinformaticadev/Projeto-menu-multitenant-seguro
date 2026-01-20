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
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    this.logger.log(`🔐 WsJwtGuard: INÍCIO - Verificando cliente`);
    try {
      const client = context.switchToWs().getClient();
      const token = this.extractToken(client);

      this.logger.log(`🔐 WsJwtGuard: Cliente ${client.id} - Token extraído:`, token ? 'Presente' : 'Ausente');

      if (!token) {
        this.logger.warn('❌ Conexão WebSocket rejeitada: Nenhum token fornecido');
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
      (client as any).user = {
        id: user.id,
        tenantId: user.tenantId,
        role: user.role,
        email: user.email,
        name: user.name
      };

      this.logger.log(`✅ Autenticação WebSocket bem-sucedida: Usuário ${user.id} (${user.email})`);
      this.logger.log(`✅ User anexado ao cliente:`, (client as any).user);
      return true;

    } catch (error) {
      this.logger.error('❌ EXCEPTION na autenticação WebSocket:', error);
      this.logger.error('❌ Stack trace:', error.stack);
      return false;
    }
  }

  private extractToken(client: any): string | null {
    return client.handshake?.auth?.token ||
      client.handshake?.headers?.authorization?.replace('Bearer ', '') ||
      null;
  }
}