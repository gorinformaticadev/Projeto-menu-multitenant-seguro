import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface RateLimitConfig {
  ttl: number;        // Time to live em milissegundos
  limit: number;      // Número máximo de requisições
  name: string;       // Nome da configuração
  message?: string;   // Mensagem personalizada
}

export interface EndpointRateLimit {
  endpoint: string;           // Padrão de rota (ex: 'auth/login')
  method?: string;            // Método HTTP específico
  configName: string;         // Nome da configuração a ser usada
  tenantSpecific?: boolean;   // Rate limit por tenant
  userSpecific?: boolean;     // Rate limit por usuário
}

@Injectable()
export class RateLimitConfigService {
  constructor(private configService: ConfigService) {}

  /**
   * Configurações padrão de rate limiting
   */
  getDefaultConfigs(): RateLimitConfig[] {
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    
    return [
      // Configuração global padrão
      {
        name: 'global',
        ttl: this.configService.get('GLOBAL_RATE_LIMIT_TTL') || 60000, // 1 minuto
        limit: isProduction 
          ? this.configService.get('GLOBAL_RATE_LIMIT_LIMIT') || 100 
          : 1000, // Mais permissivo em desenvolvimento
        message: 'Too many requests, please try again later.'
      },
      
      // Rate limit específico para login (proteção contra brute force)
      {
        name: 'login',
        ttl: 900000, // 15 minutos
        limit: isProduction ? 5 : 10, // Menos tentativas em produção
        message: 'Too many login attempts. Please try again in 15 minutes.'
      },
      
      // Rate limit para registro de usuários
      {
        name: 'register',
        ttl: 3600000, // 1 hora
        limit: isProduction ? 3 : 10, // Limitado em produção
        message: 'Too many registration attempts. Please try again in 1 hour.'
      },
      
      // Rate limit para recuperação de senha
      {
        name: 'password-reset',
        ttl: 3600000, // 1 hora
        limit: 3, // Sempre restrito
        message: 'Too many password reset requests. Please try again in 1 hour.'
      },
      
      // Rate limit para uploads
      {
        name: 'upload',
        ttl: 60000, // 1 minuto
        limit: 10, // Limitado para evitar abuso
        message: 'Too many upload requests. Please try again in 1 minute.'
      },
      
      // Rate limit para API pública
      {
        name: 'public-api',
        ttl: 60000, // 1 minuto
        limit: isProduction ? 100 : 1000,
        message: 'API rate limit exceeded.'
      },
      
      // Rate limit para endpoints administrativos
      {
        name: 'admin',
        ttl: 60000, // 1 minuto
        limit: 200, // Mais permissivo para admins
        message: 'Admin API rate limit exceeded.'
      }
    ];
  }

  /**
   * Configurações de rate limit por endpoint específico
   */
  getEndpointConfigs(): EndpointRateLimit[] {
    return [
      // Auth endpoints
      { endpoint: 'auth/login', configName: 'login', method: 'POST' },
      { endpoint: 'auth/register', configName: 'register', method: 'POST' },
      { endpoint: 'auth/forgot-password', configName: 'password-reset', method: 'POST' },
      { endpoint: 'auth/reset-password', configName: 'password-reset', method: 'POST' },
      
      // User endpoints
      { endpoint: 'users', configName: 'admin', method: 'POST' },
      { endpoint: 'users', configName: 'admin', method: 'PUT' },
      { endpoint: 'users', configName: 'admin', method: 'DELETE' },
      
      // Upload endpoints
      { endpoint: 'upload', configName: 'upload' },
      { endpoint: 'secure-files', configName: 'upload' },
      
      // Tenant endpoints (mais restrito)
      { endpoint: 'tenants', configName: 'admin', method: 'POST' },
      { endpoint: 'tenants', configName: 'admin', method: 'PUT' },
      
      // Module endpoints
      { endpoint: 'modules', configName: 'admin' },
      
      // API pública (menos restrita)
      { endpoint: 'public', configName: 'public-api' }
    ];
  }

  /**
   * Obtém configuração específica por nome
   */
  getConfigByName(name: string): RateLimitConfig | undefined {
    return this.getDefaultConfigs().find(config => config.name === name);
  }

  /**
   * Obtém configuração para um endpoint específico
   */
  getConfigForEndpoint(endpoint: string, method?: string): RateLimitConfig | undefined {
    const endpointConfig = this.getEndpointConfigs().find(config => {
      const endpointMatch = endpoint.includes(config.endpoint);
      const methodMatch = !config.method || config.method === method;
      return endpointMatch && methodMatch;
    });

    if (endpointConfig) {
      return this.getConfigByName(endpointConfig.configName);
    }

    // Retornar configuração global como fallback
    return this.getConfigByName('global');
  }

  /**
   * Verifica se rate limiting está habilitado
   */
  isRateLimitingEnabled(): boolean {
    return this.configService.get('RATE_LIMITING_ENABLED') !== 'false';
  }

  /**
   * Obtém IPs que devem ser ignorados (whitelist)
   */
  getWhitelistedIps(): string[] {
    const ips = this.configService.get('RATE_LIMIT_WHITELIST_IPS');
    if (!ips) return [];
    
    return ips.split(',').map(ip => ip.trim()).filter(ip => ip.length > 0);
  }

  /**
   * Verifica se um IP está na whitelist
   */
  isIpWhitelisted(ip: string): boolean {
    const whitelistedIps = this.getWhitelistedIps();
    return whitelistedIps.includes(ip);
  }

  /**
   * Configuração para rate limiting adaptativo
   * Ajusta limites baseado em padrões de uso
   */
  getAdaptiveConfig(baseConfig: RateLimitConfig, requestCount: number, timeWindow: number): RateLimitConfig {
    // Se houver muitas requisições em pouco tempo, reduzir o limite
    if (requestCount > baseConfig.limit * 2 && timeWindow < baseConfig.ttl / 2) {
      return {
        ...baseConfig,
        limit: Math.max(1, Math.floor(baseConfig.limit * 0.5)), // Reduz pela metade
        message: 'High traffic detected. Rate limit temporarily reduced.'
      };
    }
    
    return baseConfig;
  }

  /**
   * Configuração para diferentes níveis de severidade
   */
  getSeverityBasedConfig(severity: 'low' | 'medium' | 'high'): RateLimitConfig {
    const baseConfig = this.getConfigByName('global')!;
    
    switch (severity) {
      case 'high':
        return {
          ...baseConfig,
          limit: Math.floor(baseConfig.limit * 0.3), // 30% do normal
          message: 'High severity rate limit active.'
        };
      case 'medium':
        return {
          ...baseConfig,
          limit: Math.floor(baseConfig.limit * 0.6), // 60% do normal
          message: 'Medium severity rate limit active.'
        };
      case 'low':
      default:
        return baseConfig;
    }
  }
}