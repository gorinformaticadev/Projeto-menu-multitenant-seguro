import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { Roles } from '@core/common/decorators/roles.decorator';
import { SistemaService } from './sistema.service';

@Controller('modules/sistema/config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class SistemaController {
    constructor(
        private sistemaService: SistemaService
    ) { }

    @Get('notifications')
    async getNotificationConfig() {
        return await this.sistemaService.getNotificationConfig();
    }

    @Post('notifications')
    async saveNotificationConfig(@Body() body: any) {
        return await this.sistemaService.saveNotificationConfig(body);
    }
}
