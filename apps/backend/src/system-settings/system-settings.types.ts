export type SettingValueType = 'boolean' | 'number' | 'string' | 'json';

export type SettingValueSource = 'database' | 'env' | 'default';
export type SettingValidationSource = SettingValueSource | 'request';

export interface SettingValidatorContext {
  key: string;
  source: SettingValidationSource;
}

export interface SettingDefinition<T = unknown> {
  key: string;
  type: SettingValueType;
  defaultValue: T;
  label: string;
  description: string;
  category: string;
  envKey?: string;
  restartRequired: boolean;
  sensitive: boolean;
  requiresConfirmation: boolean;
  allowedInPanel: boolean;
  editableInPanel: boolean;
  validator?: (value: T, context: SettingValidatorContext) => boolean;
}

export interface ResolvedSetting<T = unknown> {
  key: string;
  value: T;
  source: SettingValueSource;
  definition: SettingDefinition<T>;
}
