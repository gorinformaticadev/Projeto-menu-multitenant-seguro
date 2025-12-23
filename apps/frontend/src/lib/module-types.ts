import { ComponentType, ReactNode } from 'react';

export type WidgetType = 'summary_card' | 'chart' | 'list' | 'action_button';

export interface DashboardWidgetDefinition {
    id: string;
    type: WidgetType;
    title: string;
    description?: string;
    component: ComponentType<any>;
    gridSize?: { w: number; h: number };
    permissions?: string[];
    icon?: string;
    order?: number;
}

export interface SidebarItem {
    id: string;
    label: string;
    icon?: string;
    route: string;
    order?: number;
    permissions?: string[];
    children?: SidebarItem[];
}

export interface FrontendModuleDefinition {
    id: string;
    name: string;
    widgets?: DashboardWidgetDefinition[];
    routes?: Record<string, ComponentType<any>>;
    navItems?: SidebarItem[];

    // Lifecycle hooks
    onInit?: () => void;
}
