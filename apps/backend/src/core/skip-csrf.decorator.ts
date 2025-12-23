import { SetMetadata } from '@nestjs/common';
import { SKIP_CSRF_KEY } from '@core/guards/csrf.guard';

/**
 * Decorator para pular validaÃ§Ã£o CSRF em rotas especÃ­ficas
 * 
 * Use com cautela! Apenas em rotas que realmente nÃ£o precisam de proteÃ§Ã£o CSRF,
 * como endpoints pÃºblicos de login ou que jÃ¡ usam outras formas de autenticaÃ§Ã£o.
 * 
 * @example
 * @SkipCsrf()
 * @Post('login')
 * async login() { ... }
 */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);

