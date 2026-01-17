import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappGateway } from './whatsapp.gateway';

@Module({
    imports: [],
    providers: [WhatsappService, WhatsappGateway],
    exports: [WhatsappService],
})
export class WhatsappModule { }
