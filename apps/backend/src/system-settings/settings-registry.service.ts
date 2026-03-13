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
    label: 'Notificacoes push',
    description: 'Ativa ou desativa notificacoes push em navegadores compativeis.',
    category: 'notifications',
    envKey: 'NOTIFICATIONS_PUSH_ENABLED',
    restartRequired: false,
    sensitive: false,
    requiresConfirmation: false,
    allowedInPanel: true,
    editableInPanel: true,
  }),
  'operations.watchdog.enabled': booleanSetting({
    key: 'operations.watchdog.enabled',
    defaultValue: true,
    label: 'Watchdog operacional',
    description: 'Ativa o monitoramento de falhas repetidas em jobs e cron.',
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
    category: 'security',
    envKey: 'RATE_LIMITING_ENABLED',
    restartRequired: false,
    sensitive: true,
    requiresConfirmation: true,
    allowedInPanel: true,
    editableInPanel: false,
  }),
  'security.rate_limit.advanced.enabled': booleanSetting({
    key: 'security.rate_limit.advanced.enabled',
    defaultValue: true,
    label: 'Rate limit avancado',
    description: 'Ativa regras reforcadas para rotas sensiveis e alto volume.',
    category: 'security',
    envKey: 'RATE_LIMIT_ADVANCED_ENABLED',
    restartRequired: false,
    sensitive: true,
    requiresConfirmation: true,
    allowedInPanel: true,
    editableInPanel: false,
  }),
  'security.file_signature_validation.enabled': booleanSetting({
    key: 'security.file_signature_validation.enabled',
    defaultValue: true,
    label: 'Validacao de assinatura de arquivo',
    description: 'Valida arquivos por magic number antes de aceitar uploads.',
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
    label: 'WebSocket e SSE',
    description: 'Ativa conexoes em tempo real para notificacoes e eventos.',
    category: 'security',
    envKey: 'WEBSOCKET_ENABLED',
    restartRequired: false,
    sensitive: true,
    requiresConfirmation: true,
    allowedInPanel: true,
    editableInPanel: false,
  }),
  'security.headers.enabled': booleanSetting({
    key: 'security.headers.enabled',
    defaultValue: true,
    label: 'Headers de seguranca',
    description: 'Ativa headers adicionais de endurecimento HTTP.',
    category: 'security',
    envKey: 'SECURITY_HEADERS_ENABLED',
    restartRequired: false,
    sensitive: true,
    requiresConfirmation: true,
    allowedInPanel: true,
    editableInPanel: false,
  }),
  'security.csrf.enabled': booleanSetting({
    key: 'security.csrf.enabled',
    defaultValue: false,
    label: 'Protecao CSRF',
    description: 'Ativa a protecao contra falsificacao de requisicao entre sites.',
    category: 'security',
    envKey: 'CSRF_PROTECTION_ENABLED',
    restartRequired: false,
    sensitive: true,
    requiresConfirmation: true,
    allowedInPanel: true,
    editableInPanel: false,
  }),
  'security.csp_advanced.enabled': booleanSetting({
    key: 'security.csp_advanced.enabled',
    defaultValue: false,
    label: 'CSP avancado',
    description: 'Ativa politicas CSP mais restritivas para recursos do frontend.',
    category: 'security',
    envKey: 'CSP_ADVANCED',
    restartRequired: false,
    sensitive: true,
    requiresConfirmation: true,
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
