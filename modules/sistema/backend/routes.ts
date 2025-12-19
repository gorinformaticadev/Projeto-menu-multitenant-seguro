/**
 * ARQUIVO DE ROTAS DO BACKEND - MÓDULO SISTEMA
 *
 * Este arquivo exporta os controllers que devem ser registrados pelo NestJS.
 * A nova arquitetura escaneia este arquivo para injetar as rotas automaticamente
 * no AppModulesModule.
 *
 * O array ModuleRoutes é lido pelo sistema de carregamento dinâmico que
 * registra os controllers no módulo principal da aplicação NestJS.
 */

// Importação do controller principal do módulo
import { SistemaController } from './controllers/sistema.controller';

/**
 * Lista de controllers exportados pelo módulo.
 * O loader dinâmico importará este array e o passará para o NestJS.
 *
 * Ao adicionar novos controllers, eles devem ser incluídos neste array
 * para serem registrados no sistema.
 */
export const ModuleRoutes = [
    // Controller principal do módulo sistema
    SistemaController
];