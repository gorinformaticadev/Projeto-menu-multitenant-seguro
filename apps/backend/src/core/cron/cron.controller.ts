
import { BadRequestException, Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
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
    async toggleJob(@Param('key') key: string, @Body() body: { enabled: boolean }) {
        if (typeof body?.enabled !== 'boolean') {
            throw new BadRequestException('enabled deve ser boolean');
        }

        await this.cronService.toggle(key, body.enabled);
        return { success: true, enabled: body.enabled };
    }

    @Put(':key/schedule')
    async updateSchedule(@Param('key') key: string, @Body() body: { schedule: string }) {
        const schedule = typeof body?.schedule === 'string' ? body.schedule.trim() : '';
        if (!schedule) {
            throw new BadRequestException('schedule é obrigatório');
        }

        try {
            await this.cronService.updateSchedule(key, schedule);
        } catch (error: any) {
            throw new BadRequestException(error?.message || 'falha ao atualizar schedule');
        }
        return { success: true, schedule };
    }
}
