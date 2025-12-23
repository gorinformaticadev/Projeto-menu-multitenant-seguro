import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class DuplicateRequestInterceptor implements NestInterceptor {
  private requestLog = new Map<string, number>();
  private readonly DUPLICATE_THRESHOLD = 1000; // 1 segundo

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;
    const userAgent = request.headers['user-agent'] || 'unknown';
    const ip = request.ip || 'unknown';
    
    // Cria uma chave única para a requisição
    const requestKey = `${method}:${url}:${ip}:${userAgent}`;
    const now = Date.now();
    
    // Verifica se é uma requisição duplicada
    const lastRequest = this.requestLog.get(requestKey);
    if (lastRequest && (now - lastRequest) < this.DUPLICATE_THRESHOLD) {
      console.warn(`🚨 [DUPLICATE] Possível requisição duplicada detectada:`, {
        method,
        url,
        ip,
        timeSinceLastRequest: now - lastRequest,
        userAgent: userAgent.substring(0, 50)
      });
    }
    
    // Atualiza o log
    this.requestLog.set(requestKey, now);
    
    // Limpa entradas antigas a cada 100 requisições
    if (this.requestLog.size > 1000) {
      const cutoff = now - (this.DUPLICATE_THRESHOLD * 10);
      for (const [key, timestamp] of this.requestLog.entries()) {
        if (timestamp < cutoff) {
          this.requestLog.delete(key);
        }
      }
    }

    return next.handle().pipe(
      tap(() => {
        // Log da requisição bem-sucedida
        if (url.includes('/modules/') && url.includes('/toggle')) {
          console.log(`✅ [TOGGLE] Requisição processada: ${method} ${url}`);
        }
      })
    );
  }
}