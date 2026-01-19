
import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { CronService } from './cron.service';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from '../guards/roles.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Role } from '@prisma/client';

@Controller('cron')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN) // Apenas super admins podem gerenciar crons
export class CronController {
    constructor(private readonly cronService: CronService) {
        // Empty implementation
    }

    @Get()
    listJobs() {
        return this.cronService.listJobs();
    }

    @Post(':key/trigger')
    async triggerJob(@Param('key') key: string) {
        await this.cronService.trigger(key);
        return { success: true, message: `Job ${key} disparado com sucesso` };
    }

    @Put(':key/toggle')
    toggleJob(@Param('key') key: string, @Body() body: { enabled: boolean }) {
        this.cronService.toggle(key, body.enabled);
        return { success: true, enabled: body.enabled };
    }
}
