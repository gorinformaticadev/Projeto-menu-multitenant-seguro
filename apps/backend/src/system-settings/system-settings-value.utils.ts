import { SettingDefinition, SettingValueSource } from './system-settings.types';

export interface CoerceSettingResult<T = unknown> {
  ok: boolean;
  value?: T;
  reason?: string;
}

export const coerceSettingValue = <T = unknown>(
  definition: SettingDefinition<T>,
  input: unknown,
  source: SettingValueSource,
): CoerceSettingResult<T> => {
  let coerced: unknown;

  switch (definition.type) {
    case 'boolean':
      coerced = coerceBoolean(input);
      break;
    case 'number':
      coerced = coerceNumber(input);
      break;
    case 'string':
      coerced = typeof input === 'string' ? input : undefined;
      break;
    case 'json':
      coerced = coerceJson(input);
      break;
    default:
      return { ok: false, reason: `Unsupported setting type "${String(definition.type)}"` };
  }

  if (coerced === undefined) {
    return {
      ok: false,
      reason: `Value is not valid for type "${definition.type}" from ${source}`,
    };
  }

  if (definition.validator && !definition.validator(coerced as T, { key: definition.key, source })) {
    return {
      ok: false,
      reason: `Validator rejected value for "${definition.key}" from ${source}`,
    };
  }

  return { ok: true, value: coerced as T };
};

export const readEnvValueForSetting = <T = unknown>(
  definition: SettingDefinition<T>,
  env: NodeJS.ProcessEnv = process.env,
): CoerceSettingResult<T> & { present: boolean } => {
  const envKey = definition.envKey?.trim();
  if (!envKey) {
    return { ok: false, present: false, reason: 'No envKey configured' };
  }

  const rawValue = env[envKey];
  if (rawValue === undefined || rawValue === null || rawValue.trim() === '') {
    return { ok: false, present: false, reason: `ENV ${envKey} is absent` };
  }

  return {
    ...coerceSettingValue(definition, rawValue, 'env'),
    present: true,
  };
};

const coerceBoolean = (input: unknown): boolean | undefined => {
  if (typeof input === 'boolean') {
    return input;
  }

  if (typeof input !== 'string') {
    return undefined;
  }

  const normalized = input.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return undefined;
};

const coerceNumber = (input: unknown): number | undefined => {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return input;
  }

  if (typeof input !== 'string') {
    return undefined;
  }

  const parsed = Number(input.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
};

const coerceJson = (input: unknown): unknown => {
  if (input === null) {
    return null;
  }

  if (typeof input === 'object') {
    return input;
  }

  if (typeof input !== 'string') {
    return undefined;
  }

  try {
    return JSON.parse(input);
  } catch {
    return undefined;
  }
};
