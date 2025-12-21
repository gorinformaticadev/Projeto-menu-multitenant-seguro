import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { EventBus } from './events/EventBus';

/**
 * Serviço de Notificações do CORE
 * Gerencia notificações do sistema e módulos
 */
@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);

    constructor(
        private readonly prisma: PrismaService,
        @Inject('EventBus') private readonly eventBus: EventBus
    ) { }

    /**
     * Cria uma notificação no sistema
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
        try {
            await this.prisma.notification.create({
                data: {
                    title: data.title,
                    message: data.message,
                    severity: data.severity,
                    audience: data.audience,
                    source: data.source || 'core',
                    module: data.module,
                    tenantId: data.tenantId,
                    userId: data.userId,
                    context: data.context,
                    data: data.data ? JSON.stringify(data.data) : '{}'
                }
            });

            this.logger.log(`Notificação criada: ${data.title}`);

        } catch (error) {
            this.logger.error('Erro ao criar notificação:', error);
        }
    }

    /**
     * Marca notificação como lida
     */
    async markAsRead(notificationId: string, userId: string): Promise<boolean> {
        try {
            const notification = await this.prisma.notification.findUnique({
                where: { id: notificationId }
            });

            if (!notification) {
                return false;
            }

            // Verificar se usuário pode ler esta notificação
            if (notification.userId && notification.userId !== userId) {
                return false;
            }

            await this.prisma.notification.update({
                where: { id: notificationId },
                data: {
                    read: true,
                    readAt: new Date()
                }
            });

            return true;

        } catch (error) {
            this.logger.error(`Erro ao marcar notificação ${notificationId} como lida:`, error);
            return false;
        }
    }

    /**
     * Busca notificações para um usuário
     */
    async getUserNotifications(userId: string, tenantId: string, options: {
        limit?: number;
        offset?: number;
        unreadOnly?: boolean;
    } = {}): Promise<any[]> {
        try {
            const { limit = 50, offset = 0, unreadOnly = false } = options;

            const notifications = await this.prisma.notification.findMany({
                where: {
                    OR: [
                        { userId }, // Notificações específicas do usuário
                        {
                            userId: null, // Notificações globais
                            tenantId: tenantId, // Do mesmo tenant
                            audience: {
                                in: await this.getUserAudiences(userId)
                            }
                        },
                        {
                            userId: null, // Notificações globais
                            tenantId: null, // Globais da plataforma
                            audience: {
                                in: await this.getUserAudiences(userId)
                            }
                        }
                    ],
                    ...(unreadOnly && { read: false })
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset
            });

            return notifications.map(notification => ({
                id: notification.id,
                title: notification.title,
                message: notification.message,
                severity: notification.severity,
                source: notification.source,
                module: notification.module,
                context: notification.context,
                data: JSON.parse(notification.data),
                read: notification.read,
                readAt: notification.readAt,
                createdAt: notification.createdAt
            }));

        } catch (error) {
            this.logger.error(`Erro ao buscar notificações para usuário ${userId}:`, error);
            return [];
        }
    }

    /**
     * Conta notificações não lidas
     */
    async getUnreadCount(userId: string, tenantId: string): Promise<number> {
        try {
            const count = await this.prisma.notification.count({
                where: {
                    OR: [
                        { userId, read: false },
                        {
                            userId: null,
                            tenantId: tenantId,
                            audience: {
                                in: await this.getUserAudiences(userId)
                            },
                            read: false
                        },
                        {
                            userId: null,
                            tenantId: null,
                            audience: {
                                in: await this.getUserAudiences(userId)
                            },
                            read: false
                        }
                    ]
                }
            });

            return count;

        } catch (error) {
            this.logger.error(`Erro ao contar notificações não lidas para ${userId}:`, error);
            return 0;
        }
    }

    /**
     * Notificação de módulo ativado
     */
    async notifyModuleActivated(slug: string, name: string, tenantId?: string): Promise<void> {
        await this.createNotification({
            title: 'Módulo Ativado',
            message: `O módulo "${name}" foi ativado com sucesso.`,
            severity: 'info',
            audience: 'admin',
            source: 'core',
            module: slug,
            tenantId,
            data: { moduleSlug: slug, action: 'activated' }
        });
    }

    /**
     * Notificação de erro em módulo
     */
    async notifyModuleError(slug: string, error: string, tenantId?: string): Promise<void> {
        await this.createNotification({
            title: 'Erro em Módulo',
            message: `Erro no módulo "${slug}": ${error}`,
            severity: 'critical',
            audience: 'super_admin',
            source: 'core',
            module: slug,
            tenantId,
            data: { moduleSlug: slug, error }
        });
    }

    /**
     * Notificação de migration executada
     */
    async notifyMigrationExecuted(moduleSlug: string, filename: string, success: boolean, tenantId?: string): Promise<void> {
        const severity = success ? 'info' : 'warning';
        const title = success ? 'Migration Executada' : 'Erro em Migration';
        const message = success
            ? `Migration "${filename}" do módulo "${moduleSlug}" executada com sucesso.`
            : `Erro ao executar migration "${filename}" do módulo "${moduleSlug}".`;

        await this.createNotification({
            title,
            message,
            severity,
            audience: 'super_admin',
            source: 'core',
            module: moduleSlug,
            tenantId,
            data: { moduleSlug, filename, success }
        });
    }

    /**
     * Obtém audiences que um usuário pode acessar
     */
    private async getUserAudiences(userId: string): Promise<string[]> {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true }
            });

            if (!user) return [];

            const audiences = ['user'];

            if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
                audiences.push('admin');
            }

            if (user.role === 'SUPER_ADMIN') {
                audiences.push('super_admin');
            }

            return audiences;

        } catch (error) {
            this.logger.error(`Erro ao obter audiences do usuário ${userId}:`, error);
            return ['user'];
        }
    }
}