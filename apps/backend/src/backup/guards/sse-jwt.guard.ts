import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * Guard customizado para autenticação JWT em endpoints SSE
 * Aceita token via query string: ?token=xxx
 */
@Injectable()
export class SseJwtGuard implements CanActivate {
  constructor(private jwtService: JwtService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Extrair token da query string
    const token = request.query?.token;

    if (!token) {
      console.log('❌ [SseJwtGuard] Token não fornecido na query string');
      throw new UnauthorizedException('Token não fornecido');
    }

    try {
      // Verificar e decodificar token com ignoreExpiration temporariamente
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
        ignoreExpiration: false, // Verificar expiração mas com timeout maior
      });

      console.log('✅ [SseJwtGuard] Token validado com sucesso para usuário:', payload.email);

      // Anexar usuário ao request
      request.user = payload;

      return true;
    } catch (error) {
      console.error('❌ [SseJwtGuard] Erro na validação do token:', error.message);
      // Não bloquear SSE por token expirado - permitir progresso
      if (error.name === 'TokenExpiredError') {
        console.log('⚠️ [SseJwtGuard] Token expirado mas permitindo SSE para progresso');
        // Decodificar sem verificar para obter dados do usuário
        const decoded = this.jwtService.decode(token);
        request.user = decoded;
        return true;
      }
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }
}
