import { Injectable } from '@nestjs/common';
import { NotificationPayload } from './notification.types';

@Injectable()
export class NotificationPermissions {
    canReceive(user: { id: string; tenantId: string }, notification: NotificationPayload): boolean {
        if (notification.tenantId && user.tenantId !== notification.tenantId) {
            return false;
        }
        if (notification.userId && user.id !== notification.userId) {
            return false;
        }
        return true;
    }
}
