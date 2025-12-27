import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';

@Injectable()
export class SistemaCronService implements OnModuleInit {
    private readonly logger = new Logger(SistemaCronService.name);

    constructor(
        private prisma: PrismaService
    ) { }

    async onModuleInit() {
        this.logger.log('Inicializando Sistema Cron Service');
    }

    async registerNotificationJob() {
        // Placeholder
    }
}
