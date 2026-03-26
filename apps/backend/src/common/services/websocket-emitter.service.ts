import { Injectable, Logger, Type } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { DtoMapperService } from './dto-mapper.service';

/**
 * ServiÃ§o centralizado obrigatÃ³rio para todas as transmissÃµes via WebSockets.
 * Implementa enforcing arquitetural de proteÃ§Ã£o de contratos (DTOs).
 *
 * PROIBIDO o uso de `server.emit` em qualquer Gateway. Todos os Gateways devem
 * injetar este serviÃ§o e propagar os eventos unicamente por intermÃ©dio dele.
 */
@Injectable()
export class WebsocketEmitterService {
  private readonly logger = new Logger(WebsocketEmitterService.name);
  private server: Server; // SerÃ¡ hidratado no gateway onModuleInit ou injetado

  constructor(private readonly dtoMapper: DtoMapperService) {}

  public setServer(serverInstance: Server): void {
    this.server = serverInstance;
  }

  /**
   * Envia um payload limpo, rigorosamente validado e serializado via DTO.
   */
  public emitToRoom<T>(room: string, event: string, dtoClass: Type<T>, payload: any): void {
    if (!this.server) {
      this.logger.error(`Attempt to emit ${event} failed. Server not initialized.`);
      return;
    }
    const cleanPayload = this.dtoMapper.serialize(dtoClass, payload);
    this.server.to(room).emit(event, cleanPayload);
  }

  /**
   * Envia evento direcionado de Erro que padroniza o contrato de devoluÃ§Ã£o de fails.
   */
  public emitErrorToClient(client: any, code: string, message: string): void {
    client.emit('notification:error', { code, message });
  }

  /**
   * Envia um payload formatado a um cliente sem DTO prÃ©vio aplicÃ¡vel apenas se
   * envolver primitivos (ex: primitivo de marcaÃ§Ã£o {id: 'xyz'}).
   */
  public emitPrimitiveToRoom(room: string, event: string, payload: Record<string, string | number | boolean>): void {
    this.server.to(room).emit(event, payload);
  }

  public emitPrimitiveToClient(client: any, event: string, payload: Record<string, string | number | boolean | null>): void {
    client.emit(event, payload);
  }
}
