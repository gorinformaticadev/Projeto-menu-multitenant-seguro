/**
 * ARQUIVO DE ROTAS DO BACKEND - MÓDULO SISTEMA
 *
 * Este arquivo exporta os controllers que devem ser registrados pelo NestJS.
 * A nova arquitetura escaneia este arquivo para injetar as rotas automaticamente
 * no AppModulesModule.
 */

import { SistemaController } from './sistema.controller';

/**
 * Lista de controllers exportados pelo módulo.
 * O loader dinâmico importará este array e o passará para o NestJS.
 */
export const ModuleRoutes = [
    SistemaController
];