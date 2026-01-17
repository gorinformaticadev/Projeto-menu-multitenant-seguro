import { Zap } from 'lucide-react';

export const ModuleMenu = [
    {
        id: 'whatsapp-main',
        name: 'WhatsApp',
        icon: 'MessageCircle', // Lucide icon name string
        href: '/whatsapp/dashboard',
        order: 10,
        group: 'communication',
        roles: ['ADMIN', 'SUPER_ADMIN', 'USER'],

        children: [
            {
                id: 'whatsapp-dashboard',
                name: 'Dashboard',
                href: '/whatsapp/dashboard',
                icon: 'LayoutDashboard',
                order: 1
            },
            {
                id: 'whatsapp-chat',
                name: 'Conversas',
                href: '/whatsapp/chat',
                icon: 'MessageSquare',
                order: 2
            },
            {
                id: 'whatsapp-connect',
                name: 'Conectar',
                href: '/whatsapp/connect',
                icon: 'QrCode',
                order: 3
            }
        ]
    }
];
