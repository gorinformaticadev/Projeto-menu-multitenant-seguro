import { useMemo } from 'react';
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
    const { modules, loading } = useModulesManager();

    // Usa useMemo para evitar recalcular features desnecessariamente
    const features = useMemo<ModuleFeatures>(() => {
        const userMenuItems: ModuleUserMenuItem[] = [];
        const notificationConfigs: ModuleNotificationConfig[] = [];
        const dashboardWidgets: ModuleDashboardWidget[] = [];
        const slots: ModuleSlotConfig[] = [];

        // Proteção: garante que modules seja um array
        if (!modules || !Array.isArray(modules)) {
            console.warn('⚠️ Modules não disponível ou inválido');
            return {
                userMenu: [],
                notifications: [],
                dashboardWidgets: [],
                slots: []
            };
        }

        // Processa apenas módulos ativos
        modules.filter(mod => mod.isActive).forEach((mod) => {
            if (mod.config) {
                if (mod.config.userMenu && Array.isArray(mod.config.userMenu)) {
                    userMenuItems.push(...mod.config.userMenu);
                }
                if (mod.config.notifications) {
                    notificationConfigs.push(mod.config.notifications as unknown as ModuleNotificationConfig);
                }
                if (mod.config.dashboardWidgets && Array.isArray(mod.config.dashboardWidgets)) {
                    dashboardWidgets.push(...mod.config.dashboardWidgets);
                }
                if (mod.config.slots && Array.isArray(mod.config.slots)) {
                    slots.push(...mod.config.slots);
                }
            }
        });

        const result = {
            userMenu: userMenuItems,
            notifications: notificationConfigs,
            dashboardWidgets,
            slots
        };

        // console.log('🔍 [DEBUG] Module Features processadas:', {
        //     userMenu: userMenuItems.length,
        //     notifications: notificationConfigs.length,
        //     dashboardWidgets: dashboardWidgets.length,
        //     slots: slots.length
        // });

        return result;
    }, [modules]); // Só recalcula quando modules muda

    return { features, loading };
}
