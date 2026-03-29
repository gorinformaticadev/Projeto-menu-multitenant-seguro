// Service Worker para Web Push Notifications
// Compatível com desktop Chrome e Android Chrome

const SW_VERSION = '2';

// ---------------------------------------------------------------------------
// INSTALL / ACTIVATE
// ---------------------------------------------------------------------------

self.addEventListener('install', (_event) => {
  console.log(`[SW v${SW_VERSION}] Installing...`);
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log(`[SW v${SW_VERSION}] Activating...`);
  event.waitUntil(self.clients.claim());
});

// ---------------------------------------------------------------------------
// PUSH — Recebe payload do backend e exibe notificação
// ---------------------------------------------------------------------------

self.addEventListener('push', (event) => {
  console.log('[SW Push] Event received');

  let rawPayload = null;

  // Parsing robusto: suporta JSON válido, string simples, ou ausência total
  try {
    if (event.data) {
      try {
        rawPayload = event.data.json();
      } catch {
        // Alguns ambientes (Android Chrome antigo) podem retornar texto em vez de JSON
        const text = event.data.text();
        if (text) {
          try {
            rawPayload = JSON.parse(text);
          } catch {
            rawPayload = { body: text };
          }
        }
      }
    }
  } catch (parseError) {
    console.error('[SW Push] Failed to parse push data:', parseError);
    rawPayload = {};
  }

  if (!rawPayload || typeof rawPayload !== 'object') {
    rawPayload = {};
  }

  console.log('[SW Push] Parsed payload keys:', Object.keys(rawPayload));

  // Fallback para title: suporta múltiplos formatos de payload
  const title =
    rawPayload.title ||
    (rawPayload.notification && rawPayload.notification.title) ||
    'Nova notificacao';

  // Fallback para body: suporta múltiplos formatos
  const body =
    rawPayload.body ||
    rawPayload.message ||
    (rawPayload.notification && rawPayload.notification.body) ||
    '';

  // URL para abrir no click
  const url =
    rawPayload.url ||
    (rawPayload.data && rawPayload.data.url) ||
    '/notifications';

  // Tag para agrupar/substituir notificações
  const tag = rawPayload.notificationId
    ? `notif-${rawPayload.notificationId}`
    : `notif-${Date.now()}`;

  console.log('[SW Push] Displaying notification:', {
    title,
    bodyLen: body.length,
    tag,
    url,
  });

  const options = {
    body,
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
    tag,
    data: {
      url,
      raw: rawPayload,
    },
    renotify: true,
    silent: false,
    // No Android, requireInteraction=false garante que a notificação apareça
    // sem exigir interação imediata (comportamento padrão esperado)
    requireInteraction: false,
    // actions não é necessário para este fluxo
  };

  // showNotification pode falhar silenciosamente no Android se:
  // - o SW não estiver no estado correto
  // - o payload tiver formato incompatível
  // - a permissão tiver sido revogada
  // O waitUntil garante que o SW não seja morto antes de completar
  event.waitUntil(
    self.registration
      .showNotification(title, options)
      .then(() => {
        console.log('[SW Push] Notification shown successfully');
      })
      .catch((err) => {
        console.error('[SW Push] showNotification failed:', err);
        // Fallback: tentar com opções mínimas
        return self.registration
          .showNotification(title, {
            body,
            tag,
            data: { url },
          })
          .catch((fallbackErr) => {
            console.error('[SW Push] Fallback showNotification also failed:', fallbackErr);
          });
      }),
  );
});

// ---------------------------------------------------------------------------
// NOTIFICATIONCLICK — Abre/foca a janela quando o usuário clica na notificação
// ---------------------------------------------------------------------------

self.addEventListener('notificationclick', (event) => {
  console.log('[SW Click] Notification clicked');
  event.notification.close();

  const targetUrl =
    (event.notification &&
      event.notification.data &&
      event.notification.data.url) ||
    '/notifications';

  console.log('[SW Click] Target URL:', targetUrl);

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Procurar janela existente do mesmo origin
        for (const client of clientList) {
          if ('focus' in client) {
            try {
              client.navigate(targetUrl);
            } catch {
              // navigate pode falhar se a URL for cross-origin
            }
            return client.focus();
          }
        }

        // Nenhuma janela aberta: abrir nova
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }

        return undefined;
      })
      .catch((err) => {
        console.error('[SW Click] Error handling click:', err);
      }),
  );
});

// ---------------------------------------------------------------------------
// NOTIFICATIONCLOSE — Log quando notificação é dispensada pelo usuário
// ---------------------------------------------------------------------------

self.addEventListener('notificationclose', (event) => {
  console.log('[SW Close] Notification closed:', event.notification.tag);
});

// ---------------------------------------------------------------------------
// MESSAGE — Recebe mensagens do frontend para teste local
// ---------------------------------------------------------------------------

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'TEST_NOTIFICATION') {
    console.log('[SW Message] TEST_NOTIFICATION received');
    const title = data.title || 'Teste local';
    const options = {
      body: data.body || 'Notificação de teste local (sem push)',
      icon: '/android-chrome-192x192.png',
      badge: '/favicon-32x32.png',
      tag: `test-${Date.now()}`,
      data: { url: data.url || '/notifications' },
      renotify: true,
      silent: false,
    };

    event.waitUntil(
      self.registration
        .showNotification(title, options)
        .then(() => {
          console.log('[SW Message] Local notification shown');
          // Enviar resposta de volta para o cliente
          if (event.source && event.source.postMessage) {
            event.source.postMessage({ type: 'TEST_NOTIFICATION_RESULT', success: true });
          }
        })
        .catch((err) => {
          console.error('[SW Message] Local notification failed:', err);
          if (event.source && event.source.postMessage) {
            event.source.postMessage({
              type: 'TEST_NOTIFICATION_RESULT',
              success: false,
              error: String(err),
            });
          }
        }),
    );
  }

  if (data.type === 'GET_SW_STATUS') {
    console.log('[SW Message] GET_SW_STATUS received');
    if (event.source && event.source.postMessage) {
      event.source.postMessage({
        type: 'SW_STATUS',
        version: SW_VERSION,
        state: 'active',
      });
    }
  }
});
