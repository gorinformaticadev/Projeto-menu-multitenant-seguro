import { useState, useEffect } from 'react';
import api from '@/lib/api';

export interface ModuleUserMenuItem {
    label: string;
    path: string;
    icon: string;
}

export interface ModuleNotificationConfig {
    events: Array<{
        name: string;
        title: string;
        message: string;
    }>;
}

export interface ModuleSlotConfig {
    position: string;
    content: string; // HTML, Text, or Component Name? For now string (text/html)
    type: 'text' | 'html' | 'banner' | 'alert-info' | 'text-highlight';
}

export interface ModuleDashboardWidget {
    title: string;
    description: string;
    type: 'info-card' | 'stats-card' | 'chart';
    icon: string;
    actionUrl?: string;
    actionLabel?: string;
}

export interface ModuleFeatures {
    userMenu: ModuleUserMenuItem[];
    notifications: ModuleNotificationConfig[];
    dashboardWidgets: ModuleDashboardWidget[];
    slots: ModuleSlotConfig[];
}

export function useModuleFeatures() {
    const [features, setFeatures] = useState<ModuleFeatures>({ userMenu: [], notifications: [], dashboardWidgets: [], slots: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function loadFeatures() {
            try {
                const response = await api.get('/tenants/my-tenant/modules/active');
                console.log('🔍 [DEBUG] Module Features Response:', response.data);
                const modules = response.data.modules || [];
                console.log('🔍 [DEBUG] Modules List:', modules);

                const userMenuItems: ModuleUserMenuItem[] = [];
                const notificationConfigs: ModuleNotificationConfig[] = [];
                const dashboardWidgets: ModuleDashboardWidget[] = [];
                const slots: ModuleSlotConfig[] = [];

                modules.forEach((mod: any) => {
                    if (mod.config) {
                        if (mod.config.userMenu && Array.isArray(mod.config.userMenu)) {
                            userMenuItems.push(...mod.config.userMenu);
                        }
                        if (mod.config.notifications) {
                            notificationConfigs.push(mod.config.notifications);
                        }
                        if (mod.config.dashboardWidgets && Array.isArray(mod.config.dashboardWidgets)) {
                            dashboardWidgets.push(...mod.config.dashboardWidgets);
                        }
                        if (mod.config.slots && Array.isArray(mod.config.slots)) {
                            slots.push(...mod.config.slots);
                        }
                    }
                });

                if (mounted) {
                    setFeatures({
                        userMenu: userMenuItems,
                        notifications: notificationConfigs,
                        dashboardWidgets,
                        slots
                    });
                }
            } catch (error) {
                console.error('Failed to load module features', error);
            } finally {
                if (mounted) setLoading(false);
            }
        }

        loadFeatures();
        return () => { mounted = false; };
    }, []);

    return { features, loading };
}
