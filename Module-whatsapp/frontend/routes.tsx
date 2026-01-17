import React from 'react';
import WhatsAppDashboardPage from './pages/page';
import WhatsAppChatPage from './pages/chat/page';
import WhatsAppConnectPage from './pages/connect/page';

const MODULE_ROOT = '/whatsapp';

export const ModuleRoutes = [
    { path: `${MODULE_ROOT}/dashboard`, component: WhatsAppDashboardPage },
    { path: `${MODULE_ROOT}/chat`, component: WhatsAppChatPage },
    { path: `${MODULE_ROOT}/connect`, component: WhatsAppConnectPage },
];
