import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ModeloModelService {
  private readonly logger = new Logger(ModeloModelService.name);

  constructor() { }

  logAccess(userId: string) {
    this.logger.log(`Usuário ${userId} acessou o módulo ModeloModel`);
  }
}