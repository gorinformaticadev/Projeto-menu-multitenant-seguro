import { Injectable } from '@nestjs/common';
import { WhatsappGateway } from './whatsapp.gateway';

@Injectable()
export class WhatsappBus {
    constructor(private gateway: WhatsappGateway) { }

    // Future implementation
}
