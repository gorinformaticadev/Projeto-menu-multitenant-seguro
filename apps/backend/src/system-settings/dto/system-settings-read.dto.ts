import { SettingValueSource, SettingValueType } from '../system-settings.types';

export class SystemSettingLastUpdatedByDto {
  userId!: string | null;
  email!: string | null;
  name!: string | null;
}

export class SystemSettingReadItemDto {
  key!: string;
  label!: string;
  description!: string;
  operationalNotes!: string[];
  category!: string;
  type!: SettingValueType;
  allowedInPanel!: boolean;
  editableInPanel!: boolean;
  restartRequired!: boolean;
  requiresConfirmation!: boolean;
  sensitive!: boolean;
  valueHidden!: boolean;
  resolvedValue!: unknown;
  resolvedSource!: SettingValueSource;
  hasDatabaseOverride!: boolean;
  lastUpdatedAt!: string | null;
  lastUpdatedBy!: SystemSettingLastUpdatedByDto | null;
}

export class SystemSettingsReadMetaDto {
  total!: number;
  categories!: string[];
}

export class SystemSettingsReadResponseDto {
  data!: SystemSettingReadItemDto[];
  meta!: SystemSettingsReadMetaDto;
}
