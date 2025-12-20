import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationPayload } from './notification.types';

@Injectable()
export class NotificationStore {
    constructor(private prisma: PrismaService) { }

    async save(payload: NotificationPayload) {
        try {
            // Simulate delay for testing if needed, or stick to requirements.
            // Requirement: "Persistência NUNCA pode bloquear o tempo real."
            // This method is called without await in Bus, or awaited at end.

            await this.prisma.notification.create({
                data: {
                    id: payload.id,
                    tenantId: payload.tenantId,
                    userId: payload.userId || null,
                    title: payload.title,
                    message: payload.description,
                    severity: payload.type,
                    audience: payload.userId ? 'user' : 'tenant',
                    source: payload.origin,
                    module: payload.metadata?.module || null,
                    data: JSON.stringify(payload.metadata || {}),
                    read: false,
                },
            });
        } catch (error) {
            console.error('Error saving notification:', error);
        }
    }

    async list(tenantId: string, userId: string, page = 1, limit = 20) {
        return this.prisma.notification.findMany({
            where: {
                tenantId,
                OR: [
                    { userId: userId },
                    { userId: null } // Audience tenant
                ]
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: (page - 1) * limit
        });
    }

    async count(tenantId: string, userId: string) {
        return this.prisma.notification.count({
            where: {
                tenantId,
                OR: [
                    { userId: userId },
                    { userId: null }
                ]
            }
        });
    }

    async countUnread(tenantId: string, userId: string) {
        return this.prisma.notification.count({
            where: {
                tenantId,
                read: false,
                OR: [
                    { userId: userId },
                    { userId: null }
                ]
            }
        });
    }

    async markAsRead(id: string, userId: string) {
        // Validate ownership implicitly by checking if it belongs to user/tenant
        // strict check:
        return this.prisma.notification.updateMany({
            where: { id, OR: [{ userId }, { userId: null }] },
            data: { read: true, readAt: new Date() }
        });
    }
}
