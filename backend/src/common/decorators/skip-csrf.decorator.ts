import { SetMetadata } from '@nestjs/common';
import { SKIP_CSRF_KEY } from '../guards/csrf.guard';

/**
 * Decorator para pular validação CSRF em rotas específicas
 * 
 * Use com cautela! Apenas em rotas que realmente não precisam de proteção CSRF,
 * como endpoints públicos de login ou que já usam outras formas de autenticação.
 * 
 * @example
 * @SkipCsrf()
 * @Post('login')
 * async login() { ... }
 */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);
