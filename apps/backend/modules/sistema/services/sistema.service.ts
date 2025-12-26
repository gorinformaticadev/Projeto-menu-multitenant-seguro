
import { Injectable } from '@nestjs/common';

@Injectable()
export class SistemaService {
    private config = {
        title: '',
        content: '',
        audience: 'all',
        cronExpression: '0 0 * * *',
        enabled: true
    };

    getNotificationConfig() {
        return this.config;
    }

    saveNotificationConfig(newConfig: any) {
        this.config = { ...this.config, ...newConfig };
        return this.config;
    }
}
