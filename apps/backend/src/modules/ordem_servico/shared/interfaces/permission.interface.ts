export interface PermissionUpdate {
  resource: string;
  action: string;
  allowed: boolean;
}

export interface PermissionActionDefinition {
  action: string;
  label: string;
  description?: string;
}

export interface AvailablePermission {
  resource: string;
  label: string;
  description?: string;
  actions: PermissionActionDefinition[];
}

export interface UserPermission {
  id: string;
  userId: string;
  tenantId: string;
  resource: string;
  action: string;
  allowed: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
}

export interface UserWithPermissions {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: UserPermission[];
  permissionSummary: {
    total: number;
    allowed: number;
    denied: number;
  };
}

export interface PermissionAudit {
  id: string;
  tenantId: string;
  userId: string;
  resource: string;
  action: string;
  oldValue: boolean | null;
  newValue: boolean;
  changedBy: string;
  changedAt: Date;
  reason?: string | null;
}

export interface IPermissionService {
  getUserPermissions(tenantId: string, userId: string): Promise<UserPermission[]>;
  updateUserPermissions(
    tenantId: string,
    userId: string,
    permissions: PermissionUpdate[],
    changedBy: string,
  ): Promise<void>;
  hasPermission(tenantId: string, userId: string, resource: string, action: string): Promise<boolean>;
  getAvailablePermissions(): AvailablePermission[];
  getUsersWithPermissions(tenantId: string): Promise<UserWithPermissions[]>;
  getPermissionAudit(
    tenantId: string,
    userId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<PermissionAudit[]>;
}
