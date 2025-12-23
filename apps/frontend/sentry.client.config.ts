import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Ajustar sample rate baseado no ambiente
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  
  // Desabilitar em desenvolvimento se DSN não estiver configurado
  enabled: process.env.NODE_ENV === "production" || !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Configurações adicionais
  environment: process.env.NODE_ENV,
  
  // Filtrar dados sensíveis
  beforeSend(event, hint) {
    // Remover dados sensíveis
    if (event.request) {
      if (event.request.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      
      if (event.request.data) {
        const data = typeof event.request.data === 'string' 
          ? JSON.parse(event.request.data) 
          : event.request.data;
        
        if (data.password) data.password = '[FILTERED]';
        if (data.currentPassword) data.currentPassword = '[FILTERED]';
        if (data.newPassword) data.newPassword = '[FILTERED]';
        if (data.refreshToken) data.refreshToken = '[FILTERED]';
        
        event.request.data = data;
      }
    }
    
    return event;
  },
});
