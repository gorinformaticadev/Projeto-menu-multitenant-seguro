export type SecuritySettingValueType = "boolean" | "number" | "string" | "json";
export type SecuritySettingResolvedSource = "database" | "env" | "default";

export interface SecuritySettingActor {
  userId: string | null;
  email: string | null;
  name: string | null;
}

export interface SecuritySettingItem {
  key: string;
  label: string;
  description: string;
  category: string;
  type: SecuritySettingValueType;
  allowedInPanel: boolean;
  editableInPanel: boolean;
  restartRequired: boolean;
  requiresConfirmation: boolean;
  sensitive: boolean;
  valueHidden: boolean;
  resolvedValue: unknown;
  resolvedSource: SecuritySettingResolvedSource;
  hasDatabaseOverride: boolean;
  lastUpdatedAt: string | null;
  lastUpdatedBy: SecuritySettingActor | null;
}

export interface SecuritySettingsReadResponse {
  data: SecuritySettingItem[];
  meta: {
    total: number;
    categories: string[];
  };
}

export interface SecuritySettingMutationResponse {
  action: "update" | "restore_fallback";
  setting: SecuritySettingItem;
}
