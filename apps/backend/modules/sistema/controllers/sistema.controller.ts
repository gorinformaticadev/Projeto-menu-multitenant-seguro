
import { Controller, Get, Post, Body } from '@nestjs/common';
import { SistemaService } from './sistema.service';

@Controller('modules/sistema')
export class SistemaController {
    constructor(private readonly service: SistemaService) { }

    @Get('config/notifications')
    async getConfig() {
        return this.service.getNotificationConfig();
    }

    @Post('config/notifications')
    async saveConfig(@Body() body: any) {
        return this.service.saveNotificationConfig(body);
    }
}
