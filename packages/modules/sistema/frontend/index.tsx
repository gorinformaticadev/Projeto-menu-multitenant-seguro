import React from 'react';
import { FrontendModuleDefinition } from '@/lib/module-types';
import { SistemaWidget } from './components/SistemaWidget';

export const SistemaModule: FrontendModuleDefinition = {
    id: 'sistema',
    name: 'Sistema',
    widgets: [
        {
            id: 'sistema-status',
            type: 'summary_card',
            title: 'Status do Sistema',
            component: SistemaWidget,
            gridSize: { w: 1, h: 1 },
            order: 1,
            icon: 'Activity'
        }
    ]
};
