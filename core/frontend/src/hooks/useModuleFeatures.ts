import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { useRequestLimiter } from '@/lib/request-limiter';

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
    content: string;
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

const EMPTY_FEATURES: ModuleFeatures = {
    userMenu: [],
    notifications: [],
    dashboardWidgets: [],
    slots: []
};

export function useModuleFeatures() {
    const [features, setFeatures] = useState<ModuleFeatures>(EMPTY_FEATURES);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const limiter = useRequestLimiter('module-features');
    const mountedRef = useRef(true);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const loadFeatures = useCallback(async (isFirstLoad = false): Promise<boolean> => {
        try {
            if (isFirstLoad) {
                setLoading(true);
                setError(null);
            }

            // Verificar cache primeiro
            const cachedData = limiter.getCachedData();
            if (cachedData && !isFirstLoad) {
                console.log('🎯 [ModuleFeatures] Usando dados do cache');
                if (mountedRef.current) {
                    setFeatures(cachedData);
                }
                return true;
            }

            // Verificar rate limit
            if (!limiter.canMakeRequest()) {
                console.warn('🚫 [ModuleFeatures] Rate limit atingido, usando cache ou dados atuais');
                return false;
            }

            console.log('🔄 [ModuleFeatures] Carregando features dos módulos...');
            const response = await api.get('/tenants/my-tenant/modules/active');
            const modules = response.data.modules || [];

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

            const newFeatures: ModuleFeatures = {
                userMenu: userMenuItems,
                notifications: notificationConfigs,
                dashboardWidgets,
                slots
            };

            // Armazenar no cache
            limiter.setCachedData(newFeatures);
            limiter.recordSuccess();

            if (mountedRef.current) {
                setFeatures(prev => {
                    const hasChanged = JSON.stringify(prev) !== JSON.stringify(newFeatures);
                    if (hasChanged) {
                        console.log('✅ [ModuleFeatures] Features atualizadas');
                    }
                    return newFeatures;
                });
                
                if (isFirstLoad) {
                    setError(null);
                }
            }

            return true;
        } catch (error: any) {
            console.error('❌ [ModuleFeatures] Erro ao carregar features:', error);
            limiter.recordFailure();

            if (mountedRef.current && isFirstLoad) {
                setError(error.message || 'Falha ao carregar features dos módulos');
            }

            // Em caso de erro, tentar usar cache mesmo que expirado
            const cachedData = limiter.getCachedData();
            if (cachedData && mountedRef.current) {
                console.log('🔄 [ModuleFeatures] Usando cache expirado devido ao erro');
                setFeatures(cachedData);
            }

            return false;
        } finally {
            if (mountedRef.current && isFirstLoad) {
                setLoading(false);
            }
        }
    }, [limiter]);

    const refreshFeatures = useCallback(() => {
        limiter.clearKey();
        loadFeatures(true);
    }, [limiter, loadFeatures]);

    useEffect(() => {
        mountedRef.current = true;

        // Carregamento inicial
        loadFeatures(true);

        // Polling inteligente - apenas se não houver circuit breaker ativo
        intervalRef.current = setInterval(() => {
            if (mountedRef.current) {
                loadFeatures(false);
            }
        }, 30000); // Aumentado para 30 segundos

        return () => {
            mountedRef.current = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [loadFeatures]);

    // Cleanup no unmount
    useEffect(() => {
        return () => {
            mountedRef.current = false;
        };
    }, []);

    return {
        features,
        loading,
        error,
        refreshFeatures,
        stats: limiter.getStats()
    };
}