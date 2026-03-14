import { Injectable } from '@nestjs/common';
import { SettingDefinition } from './system-settings.types';

const booleanSetting = (
  definition: Omit<SettingDefinition<boolean>, 'type' | 'validator'>,
): SettingDefinition<boolean> => ({
  ...definition,
  type: 'boolean',
  validator: (value) => typeof value === 'boolean',
});

export const SETTINGS_REGISTRY_DEFINITIONS = {
  'security.module_upload.enabled': booleanSetting({
    key: 'security.module_upload.enabled',
    defaultValue: false,
    label: 'Upload de modulos',
    description: 'Permite instalar ou bloquear o upload de modulos no sistema.',
    operationalNotes: [
      'Em development, upload, uninstall e reload continuam liberados automaticamente independentemente deste toggle.',
      'Fora de development, este toggle controla as operacoes mutaveis de modulos.',
    ],
    category: 'security',
    envKey: 'ENABLE_MODULE_UPLOAD',
    restartRequired: false,
    sensitive: false,
    requiresConfirmation: true,
    allowedInPanel: true,
    editableInPanel: true,
  }),
  'notifications.enabled': booleanSetting({
    key: 'notifications.enabled',
    defaultValue: true,
    label: 'Notificacoes do sistema',
    description: 'Ativa ou desativa o envio de notificacoes do sistema.',
    operationalNotes: [
      'Afeta apenas novas notificacoes geradas depois da mudanca.',
      'Notificacoes ja persistidas continuam legiveis e listaveis normalmente.',
    ],
    category: 'notifications',
    envKey: 'NOTIFICATIONS_ENABLED',
    restartRequired: false,
    sensitive: false,
    requiresConfirmation: false,
    allowedInPanel: true,
    editableInPanel: true,
  }),
  'notifications.push.enabled': booleanSetting({
    key: 'notifications.push.enabled',
    defaultValue: false,
    label: 'Entrega Web Push',
    description:
      'Controla a tentativa real de envio Web Push para subscriptions ja registradas quando houver VAPID valido.',
    operationalNotes: [
      'Controla apenas a tentativa de entrega push no PushNotificationService. Nao cria nem persiste notificacoes.',
      'Notifications.enabled continua controlando a criacao/persistencia da notificacao, e security.websocket.enabled continua controlando o canal realtime/socket.',
      'Disponibilidade de public key VAPID ou existencia de subscriptions nao equivale a entrega habilitada; se esta chave estiver desligada, o envio push nao e tentado.',
      'Mesmo ligada, ausencia de VAPID valido, dependencia web-push ou subscriptions continua mantendo o comportamento atual sem entrega.',
      'Cada processo pode levar ate 15 segundos para refletir a mudanca por causa do cache local do servico.',
      'Afeta apenas novas tentativas de envio depois da mudanca.',
    ],
    category: 'notifications',
    envKey: 'NOTIFICATIONS_PUSH_ENABLED',
    restartRequired: false,
    sensitive: false,
    requiresConfirmation: true,
    allowedInPanel: true,
    editableInPanel: true,
  }),
  'operations.watchdog.enabled': booleanSetting({
    key: 'operations.watchdog.enabled',
    defaultValue: true,
    label: 'Watchdog operacional',
    description: 'Ativa o monitoramento de falhas repetidas em jobs e cron.',
    operationalNotes: [
      'O cron do watchdog continua registrado; a mudanca passa a valer na proxima execucao do job.',
      'Mesmo ligado, a emissao final do alerta ainda depende de operations.alerts.enabled.',
    ],
    category: 'operations',
    envKey: 'OPS_WATCHDOG_ENABLED',
    restartRequired: false,
    sensitive: false,
    requiresConfirmation: false,
    allowedInPanel: true,
    editableInPanel: true,
  }),
  'operations.alerts.enabled': booleanSetting({
    key: 'operations.alerts.enabled',
    defaultValue: true,
    label: 'Alertas operacionais',
    description: 'Ativa alertas automaticos de latencia, 5xx e incidentes operacionais.',
    operationalNotes: [
      'Controla a geracao de novos alertas operacionais, nao a deteccao das condicoes monitoradas.',
      'A persistencia final do alerta ainda depende de notifications.enabled.',
    ],
    category: 'operations',
    envKey: 'OPS_ALERTS_ENABLED',
    restartRequired: false,
    sensitive: false,
    requiresConfirmation: false,
    allowedInPanel: true,
    editableInPanel: true,
  }),
  'security.rate_limit.enabled': booleanSetting({
    key: 'security.rate_limit.enabled',
    defaultValue: true,
    label: 'Rate limit global',
    description: 'Ativa ou desativa o rate limit global do backend.',
    operationalNotes: [
      'Controla apenas o rate limit global/base. Rotas com @Throttle explicito continuam usando suas proprias politicas.',
      'Cada processo pode levar ate 15 segundos para refletir a mudanca por causa do snapshot local do guard.',
      'Nesta fase o painel exibe o estado, mas mantem esta chave como somente leitura.',
    ],
    category: 'security',
    envKey: 'RATE_LIMITING_ENABLED',
    restartRequired: false,
    sensitive: false,
    requiresConfirmation: false,
    allowedInPanel: true,
    editableInPanel: false,
  }),
  'security.rate_limit.advanced.enabled': booleanSetting({
    key: 'security.rate_limit.advanced.enabled',
    defaultValue: true,
    label: 'Rate limit avancado',
    description:
      'Controla apenas os reforcos avancados do rate limiting global para rotas sensiveis, alto volume e trafego autenticado.',
    operationalNotes: [
      'Controla apenas os reforcos avancados aplicados pelo SecurityThrottlerGuard. O rate limit global/base continua separado em security.rate_limit.enabled.',
      'Rotas com @Throttle explicito continuam usando suas proprias politicas e nao passam a obedecer este toggle automaticamente.',
      'Cada processo pode levar ate 15 segundos para refletir a mudanca por causa do snapshot local do guard.',
      'Nesta fase o painel exibe o estado atual, mas mantem esta chave como somente leitura.',
    ],
    category: 'security',
    envKey: 'RATE_LIMIT_ADVANCED_ENABLED',
    restartRequired: false,
    sensitive: false,
    requiresConfirmation: false,
    allowedInPanel: true,
    editableInPanel: false,
  }),
  'security.file_signature_validation.enabled': booleanSetting({
    key: 'security.file_signature_validation.enabled',
    defaultValue: true,
    label: 'Validacao de assinatura de arquivo',
    description: 'Valida arquivos por magic number antes de aceitar uploads.',
    operationalNotes: [
      'Afeta apenas novos uploads processados apos a mudanca.',
    ],
    category: 'security',
    envKey: 'ENABLE_FILE_SIGNATURE_VALIDATION',
    restartRequired: false,
    sensitive: false,
    requiresConfirmation: false,
    allowedInPanel: true,
    editableInPanel: true,
  }),
  'security.websocket.enabled': booleanSetting({
    key: 'security.websocket.enabled',
    defaultValue: true,
    label: 'Canal WebSocket realtime',
    description: 'Ativa ou desativa o canal Socket.IO dos gateways realtime ativos do backend.',
    operationalNotes: [
      'Nesta etapa controla apenas os gateways Socket.IO ativos do backend. SSE e outros canais realtime continuam fora deste escopo.',
      'Quando desligado, novas conexoes websocket sao rejeitadas e novas emissoes realtime passam a ser suprimidas.',
      'Conexoes ja abertas e ociosas podem permanecer ate nova interacao, emissao ou reconexao; este toggle nao faz dreno global instantaneo.',
      'Cada processo pode levar ate 15 segundos para refletir a mudanca por causa do cache local do resolvedor.',
      'Notifications.enabled continua separado da criacao/persistencia de notificacoes, e notifications.push.enabled continua separado do push.',
      'Nesta fase o painel exibe o estado atual, mas mantem esta chave como somente leitura devido ao limite operacional do canal.',
    ],
    category: 'security',
    envKey: 'WEBSOCKET_ENABLED',
    restartRequired: false,
    sensitive: false,
    requiresConfirmation: false,
    allowedInPanel: true,
    editableInPanel: false,
  }),
  'security.headers.enabled': booleanSetting({
    key: 'security.headers.enabled',
    defaultValue: true,
    label: 'Headers de seguranca',
    description: 'Ativa headers adicionais de endurecimento HTTP.',
    operationalNotes: [
      'Controla apenas os headers extras de seguranca aplicados no bootstrap HTTP central do backend.',
      'CSP avancado e protecao CSRF continuam separados deste toggle.',
      'Mudancas nesta chave so passam a valer apos reiniciar o processo do backend.',
      'Nesta fase o painel exibe o estado atual, mas mantem esta chave como somente leitura.',
    ],
    category: 'security',
    envKey: 'SECURITY_HEADERS_ENABLED',
    restartRequired: true,
    sensitive: false,
    requiresConfirmation: false,
    allowedInPanel: true,
    editableInPanel: false,
  }),
  'security.csrf.enabled': booleanSetting({
    key: 'security.csrf.enabled',
    defaultValue: false,
    label: 'Protecao CSRF',
    description: 'Ativa a validacao CSRF global do backend para requests mutaveis.',
    operationalNotes: [
      'Controla apenas a validacao CSRF do guard global. Headers extras e CSP avancado continuam separados.',
      'Cada processo pode levar ate 15 segundos para refletir a mudanca por causa do cache local do guard.',
      'Quando habilitado, clientes reais precisam enviar cookie e header CSRF validos ou podem receber 403.',
      'Nesta fase o painel exibe o estado atual, mas mantem esta chave como somente leitura devido ao risco operacional.',
    ],
    category: 'security',
    envKey: 'CSRF_PROTECTION_ENABLED',
    restartRequired: false,
    sensitive: false,
    requiresConfirmation: false,
    allowedInPanel: true,
    editableInPanel: false,
  }),
  'security.csp_advanced.enabled': booleanSetting({
    key: 'security.csp_advanced.enabled',
    defaultValue: false,
    label: 'CSP avancado',
    description: 'Ativa a politica CSP avancada aplicada pelo middleware global do backend.',
    operationalNotes: [
      'Controla apenas a sobrescrita da CSP avancada no CspMiddleware global. A CSP basica de security.headers.enabled continua separada.',
      'Cada processo pode levar ate 15 segundos para refletir a mudanca por causa do cache local do middleware.',
      'Quando habilitado, paginas e clientes reais podem falhar ao carregar scripts, estilos, imagens ou conexoes que nao estejam cobertos pela politica atual.',
      'Nesta fase o painel exibe o estado atual, mas mantem esta chave como somente leitura devido ao risco operacional para o frontend real.',
    ],
    category: 'security',
    envKey: 'CSP_ADVANCED',
    restartRequired: false,
    sensitive: false,
    requiresConfirmation: false,
    allowedInPanel: true,
    editableInPanel: false,
  }),
} as const satisfies Record<string, SettingDefinition>;

export type RegisteredSettingKey = keyof typeof SETTINGS_REGISTRY_DEFINITIONS;

@Injectable()
export class SettingsRegistry {
  private readonly definitions = SETTINGS_REGISTRY_DEFINITIONS;
  private readonly allDefinitions = Object.freeze(Object.values(this.definitions));

  has(key: string): key is RegisteredSettingKey {
    return Object.prototype.hasOwnProperty.call(this.definitions, key);
  }

  get<T = unknown>(key: string): SettingDefinition<T> | undefined {
    return this.definitions[key as RegisteredSettingKey] as SettingDefinition<T> | undefined;
  }

  getOrThrow<T = unknown>(key: string): SettingDefinition<T> {
    const definition = this.get<T>(key);
    if (!definition) {
      throw new Error(`Dynamic setting "${key}" is not registered`);
    }
    return definition;
  }

  getAll(): readonly SettingDefinition[] {
    return this.allDefinitions;
  }

  getAllowedInPanel(): readonly SettingDefinition[] {
    return this.allDefinitions.filter((definition) => definition.allowedInPanel);
  }

  isEditableInPanel(key: string): boolean {
    return this.get(key)?.editableInPanel === true;
  }
}
