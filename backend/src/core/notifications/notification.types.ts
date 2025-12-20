export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type NotificationOrigin = 'system' | 'orders' | 'modules';

export interface NotificationPayload {
    id?: string;
    tenantId: string | null;
    userId?: string | null;
    title: string;
    description: string;
    type: NotificationType;
    origin: NotificationOrigin;
    permissions?: {
        canRead?: boolean;
        canDelete?: boolean;
    };
    metadata?: {
        module?: string;
        entityId?: string;
        [key: string]: any;
    };
}
