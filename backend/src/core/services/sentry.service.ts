import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SentryService {
  constructor(private config: ConfigService) {
    this.init();
  }

  private init() {
    const dsn = this.config.get('SENTRY_DSN');
    const environment = this.config.get('NODE_ENV', 'development');

    // Apenas inicializar se DSN estiver configurado
    if (!dsn) {
      console.log('⚠️  Sentry DSN não configurado - Monitoramento desabilitado');
      return;
    }

    Sentry.init({
      dsn,
      environment,
      integrations: [
        nodeProfilingIntegration(),
      ],
      // Performance Monitoring
      tracesSampleRate: environment === 'production' ? 0.1 : 1.0, // 10% em produção, 100% em dev
      // Profiling
      profilesSampleRate: environment === 'production' ? 0.1 : 1.0,
      // Filtrar dados sensíveis
      beforeSend(event, hint) {
        // Remover dados sensíveis
        if (event.request) {
          // Remover headers sensíveis
          if (event.request.headers) {
            delete event.request.headers['authorization'];
            delete event.request.headers['cookie'];
          }

          // Remover dados sensíveis do body
          if (event.request.data) {
            const data = typeof event.request.data === 'string' 
              ? JSON.parse(event.request.data) 
              : event.request.data;

            if (data.password) data.password = '[FILTERED]';
            if (data.currentPassword) data.currentPassword = '[FILTERED]';
            if (data.newPassword) data.newPassword = '[FILTERED]';
            if (data.adminPassword) data.adminPassword = '[FILTERED]';
            if (data.refreshToken) data.refreshToken = '[FILTERED]';

            event.request.data = data;
          }
        }

        return event;
      },
    });

    console.log('✅ Sentry inicializado');
  }

  /**
   * Capturar exceção manualmente
   */
  captureException(exception: any, context?: any) {
    Sentry.captureException(exception, {
      contexts: context,
    });
  }

  /**
   * Capturar mensagem
   */
  captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
    Sentry.captureMessage(message, level);
  }

  /**
   * Adicionar contexto do usuário
   */
  setUser(user: { id: string; email: string; role: string }) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      role: user.role,
    });
  }

  /**
   * Remover contexto do usuário
   */
  clearUser() {
    Sentry.setUser(null);
  }

  /**
   * Adicionar breadcrumb (rastro de ações)
   */
  addBreadcrumb(message: string, category: string, data?: any) {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
    });
  }
}
