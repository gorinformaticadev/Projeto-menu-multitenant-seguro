/**
 * Sistema de Rate Limiting para controlar requisições excessivas
 * Implementa circuit breaker pattern e cache inteligente
 */

interface RequestCache {
  data: any;
  timestamp: number;
  etag?: string;
}

interface RequestLimiterConfig {
  maxRequestsPerMinute: number;
  cacheTimeMs: number;
  circuitBreakerThreshold: number;
  circuitBreakerResetTimeMs: number;
}

class RequestLimiter {
  private requests: Map<string, number[]> = new Map();
  private cache: Map<string, RequestCache> = new Map();
  private circuitBreakers: Map<string, { failures: number; lastFailure: number; isOpen: boolean }> = new Map();
  
  private config: RequestLimiterConfig = {
    maxRequestsPerMinute: 10,
    cacheTimeMs: 30000, // 30 segundos
    circuitBreakerThreshold: 3,
    circuitBreakerResetTimeMs: 60000 // 1 minuto
  };

  constructor(config?: Partial<RequestLimiterConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Verifica se uma requisição pode ser feita
   */
  canMakeRequest(key: string): boolean {
    const now = Date.now();
    
    // Verificar circuit breaker
    const breaker = this.circuitBreakers.get(key);
    if (breaker?.isOpen) {
      if (now - breaker.lastFailure > this.config.circuitBreakerResetTimeMs) {
        // Reset circuit breaker
        this.circuitBreakers.set(key, { failures: 0, lastFailure: 0, isOpen: false });
      } else {
        console.warn(`[RequestLimiter] Circuit breaker aberto para ${key}`);
        return false;
      }
    }

    // Verificar rate limit
    const requests = this.requests.get(key) || [];
    const oneMinuteAgo = now - 60000;
    
    // Limpar requisições antigas
    const recentRequests = requests.filter(timestamp => timestamp > oneMinuteAgo);
    
    if (recentRequests.length >= this.config.maxRequestsPerMinute) {
      console.warn(`[RequestLimiter] Rate limit excedido para ${key}: ${recentRequests.length}/${this.config.maxRequestsPerMinute}`);
      return false;
    }

    // Registrar nova requisição
    recentRequests.push(now);
    this.requests.set(key, recentRequests);
    
    return true;
  }

  /**
   * Verifica se existe cache válido para uma chave
   */
  getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.config.cacheTimeMs) {
      this.cache.delete(key);
      return null;
    }

    console.log(`[RequestLimiter] Cache hit para ${key}`);
    return cached.data;
  }

  /**
   * Armazena dados no cache
   */
  setCachedData(key: string, data: any, etag?: string): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      etag
    });
  }

  /**
   * Registra uma falha na requisição
   */
  recordFailure(key: string): void {
    const breaker = this.circuitBreakers.get(key) || { failures: 0, lastFailure: 0, isOpen: false };
    breaker.failures++;
    breaker.lastFailure = Date.now();

    if (breaker.failures >= this.config.circuitBreakerThreshold) {
      breaker.isOpen = true;
      console.warn(`[RequestLimiter] Circuit breaker ativado para ${key} após ${breaker.failures} falhas`);
    }

    this.circuitBreakers.set(key, breaker);
  }

  /**
   * Registra uma requisição bem-sucedida
   */
  recordSuccess(key: string): void {
    const breaker = this.circuitBreakers.get(key);
    if (breaker) {
      breaker.failures = 0;
      breaker.isOpen = false;
      this.circuitBreakers.set(key, breaker);
    }
  }

  /**
   * Limpa cache e contadores para uma chave específica
   */
  clearKey(key: string): void {
    this.requests.delete(key);
    this.cache.delete(key);
    this.circuitBreakers.delete(key);
  }

  /**
   * Limpa todo o cache e contadores
   */
  clearAll(): void {
    this.requests.clear();
    this.cache.clear();
    this.circuitBreakers.clear();
  }

  /**
   * Obtém estatísticas do rate limiter
   */
  getStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [key, requests] of this.requests.entries()) {
      const breaker = this.circuitBreakers.get(key);
      const cached = this.cache.get(key);
      
      stats[key] = {
        requestsLastMinute: requests.length,
        circuitBreakerOpen: breaker?.isOpen || false,
        failures: breaker?.failures || 0,
        hasCachedData: !!cached,
        cacheAge: cached ? Date.now() - cached.timestamp : null
      };
    }
    
    return stats;
  }
}

// Instância global do rate limiter
export const globalRequestLimiter = new RequestLimiter({
  maxRequestsPerMinute: 6, // Reduzido para evitar 429
  cacheTimeMs: 45000, // 45 segundos de cache
  circuitBreakerThreshold: 2, // Mais sensível
  circuitBreakerResetTimeMs: 120000 // 2 minutos para reset
});

// Hook para usar o rate limiter
export function useRequestLimiter(key: string) {
  return {
    canMakeRequest: () => globalRequestLimiter.canMakeRequest(key),
    getCachedData: () => globalRequestLimiter.getCachedData(key),
    setCachedData: (data: any, etag?: string) => globalRequestLimiter.setCachedData(key, data, etag),
    recordFailure: () => globalRequestLimiter.recordFailure(key),
    recordSuccess: () => globalRequestLimiter.recordSuccess(key),
    clearKey: () => globalRequestLimiter.clearKey(key),
    getStats: () => globalRequestLimiter.getStats()
  };
}

export default RequestLimiter;