import { useState, useEffect } from 'react';
import { useModulesManager } from './useModulesManager';

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
    const { modules, loading } = useModulesManager();

    useEffect(() => {
        // Processa features dos módulos sempre que a lista de módulos muda
        const userMenuItems: ModuleUserMenuItem[] = [];
        const notificationConfigs: ModuleNotificationConfig[] = [];
        const dashboardWidgets: ModuleDashboardWidget[] = [];
        const slots: ModuleSlotConfig[] = [];

        // Processa apenas módulos ativos
        modules.filter(mod => mod.isActive).forEach((mod) => {
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

        setFeatures({
            userMenu: userMenuItems,
            notifications: notificationConfigs,
            dashboardWidgets,
            slots
        });

        console.log('🔍 [DEBUG] Module Features processadas:', {
            userMenu: userMenuItems.length,
            notifications: notificationConfigs.length,
            dashboardWidgets: dashboardWidgets.length,
            slots: slots.length
        });
    }, [modules]);

    return { features, loading };
}
