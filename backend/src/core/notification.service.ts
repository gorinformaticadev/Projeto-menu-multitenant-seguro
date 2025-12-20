import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { NotificationCore } from './notifications/notification.core';
import { NotificationStore } from './notifications/notification.store';
import { NotificationPayload } from './notifications/notification.types';

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationCore: NotificationCore,
        private readonly notificationStore: NotificationStore
    ) { }

    /**
     * Adapta chamadas antigas para o novo NotificationCore
     */
    async createNotification(data: {
        title: string;
        message: string;
        severity: 'info' | 'warning' | 'critical';
        audience: 'user' | 'admin' | 'super_admin';
        source?: 'core' | 'module';
        module?: string;
        tenantId?: string;
        userId?: string;
        context?: string;
        data?: Record<string, any>;
    }): Promise<void> {
        let type: 'info' | 'success' | 'warning' | 'error' = 'info';
        if (data.severity === 'critical') type = 'error';
        else if (data.severity === 'warning') type = 'warning';

        let origin: 'system' | 'orders' | 'modules' = 'system';
        if (data.source === 'module') origin = 'modules';

        const payload: NotificationPayload = {
            tenantId: data.tenantId || null,
            userId: data.userId,
            title: data.title,
            description: data.message,
            type,
            origin,
            metadata: {
                ...data.data,
                module: data.module,
                context: data.context,
                audience: data.audience,
            },
        };

        // 📦 Notification Core é chamado
        this.notificationCore.notify(payload);
    }

    /**
     * Mantém compatibilidade para contagem de não lidas (usado no menu)
     */
    async getUnreadCount(userId: string, tenantId: string): Promise<number> {
        try {
            const audiences = await this.getUserAudiences(userId);
            const count = await this.prisma.notification.count({
                where: {
                    OR: [
                        { userId, read: false },
                        {
                            userId: null,
                            tenantId: tenantId,
                            audience: { in: audiences },
                            read: false,
                        },
                        {
                            userId: null,
                            tenantId: null,
                            audience: { in: audiences },
                            read: false,
                        },
                    ],
                },
            });
            return count;
        } catch (error) {
            return 0;
        }
    }

    private async getUserAudiences(userId: string): Promise<string[]> {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true },
            });

            if (!user) return [];

            const audiences = ['user'];
            // Assuming Role enum is string compatible in basic checks
            const role = user.role as unknown as string;

            if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
                audiences.push('admin');
            }

            if (role === 'SUPER_ADMIN') {
                audiences.push('super_admin');
            }

            return audiences;
        } catch (error) {
            return ['user'];
        }
    }
}