import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  /**
   * Sobrescreve o tratamento de requisição para NÃO lançar erro
   * se o token for inválido ou ausente.
   */
  handleRequest<TUser>(err: unknown, user: TUser | false | null): TUser | undefined {
    if (err || !user) {
      return undefined;
    }
    return user;
  }
}
