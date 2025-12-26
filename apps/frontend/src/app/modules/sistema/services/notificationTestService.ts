import api from '@/lib/api';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type NotificationTarget = 'all_users' | 'admins_only' | 'super_admins';
export type NotificationScope = 'global' | 'tenants';

export interface SendNotificationPayload {
    title: string;
    description: string;
    type: NotificationType;
    target: NotificationTarget;
    scope: NotificationScope;
    tenantIds?: string[];
}

class NotificationTestService {
    async getTenants(): Promise<{ id: string; name: string }[]> {
        try {
            // Trying common endpoints for tenants
            const response = await api.get('/tenants');
            return response.data;
        } catch (error) {
            console.error('Failed to fetch tenants:', error);
            // Return mock data if API fails, to prevent UI crash during development
            return [];
        }
    }

    async sendNotification(payload: SendNotificationPayload): Promise<void> {
        await api.post('/modules/sistema/notifications/send', payload);
    }
}

export const notificationTestService = new NotificationTestService();
