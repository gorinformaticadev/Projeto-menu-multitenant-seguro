import React from 'react';
import { FrontendModuleDefinition } from '@/lib/module-types';

export const whatsappModule: FrontendModuleDefinition = {
    id: 'whatsapp',
    name: 'WhatsApp Business',

    widgets: [
        // Exemplo de widget
        // {
        //     id: 'whatsapp-status',
        //     type: 'summary_card',
        //     title: 'WhatsApp Status',
        //     component: () => <div>Widget Info</div>,
        //     gridSize: { w: 1, h: 1 },
        //     order: 1,
        //     icon: 'MessageCircle'
        // }
    ]
};
