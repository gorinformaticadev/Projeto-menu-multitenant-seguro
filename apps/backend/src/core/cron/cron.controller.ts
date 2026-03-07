import { BadRequestException, Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { CronService } from './cron.service';

@Controller('cron')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class CronController {
  constructor(private readonly cronService: CronService) {}

  @Get()
  async listJobs() {
    return this.cronService.listJobs();
  }

  @Get('runtime')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async getRuntimeJobs() {
    return this.cronService.getRuntimeJobs();
  }

  @Post(':key/trigger')
  async triggerJob(@Param('key') key: string) {
    await this.cronService.trigger(key);
    return { success: true, message: `Tarefa ${key} executada com sucesso` };
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
      throw new BadRequestException('schedule e obrigatorio');
    }

    try {
      await this.cronService.updateSchedule(key, schedule);
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'falha ao atualizar schedule';
      throw new BadRequestException(message);
    }

    return { success: true, schedule };
  }
}
