import api from '@/lib/api';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type NotificationTarget = 'all_users' | 'admins_only' | 'super_admins';
export type NotificationScope = 'global' | 'tenants'; // Alterado de 'tenant' para 'tenants' para refletir múltipla seleção

export interface CreateNotificationDto {
    title: string;
    description: string;
    type: NotificationType;
    scope: NotificationScope;
    tenantIds?: string[]; // Suporte a múltiplos tenants
    target: NotificationTarget;
}

export const notificationTestService = {
    /**
     * Envia um aviso/notificação para um público alvo
     */
    sendNotification: async (data: CreateNotificationDto) => {
        return api.post('/notifications/broadcast', data);
    },

    /**
     * Busca lista de tenants para seleção
     */
    getTenants: async () => {
        try {
            const res = await api.get('/tenants');
            const rawData = res.data?.items || res.data;

            if (Array.isArray(rawData)) {
                return rawData.map((t: any) => ({
                    id: t.id,
                    name: t.fantasyName || t.nomeFantasia || t.name || t.nome || t.companyName || t.slug || 'Tenant sem nome'
                }));
            }
            return [];
        } catch (e) {
            console.warn('API de tenants não carregada ou falhou, usando dados simulados.');
            return [
                { id: '1', name: 'Empresa Demo A' },
                { id: '2', name: 'Comércio e Silva' },
                { id: '3', name: 'StartTech Solutions' },
                { id: '4', name: 'Transportadora Veloz' },
                { id: '5', name: 'Grupo Empresarial X' }
            ];
        }
    }
};
