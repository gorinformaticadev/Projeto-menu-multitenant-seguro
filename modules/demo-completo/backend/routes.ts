/**
 * ARQUIVO DE ROTAS DO BACKEND - MÓDULO DEMO COMPLETO
 * 
 * Este arquivo exporta os controllers que devem ser registrados pelo NestJS.
 * A nova arquitetura escaneia este arquivo para injetar as rotas automaticamente
 * no AppModulesModule.
 */

import { DemoController } from './controllers/demo.controller';
import { CategoryController } from './controllers/category.controller';
import { TagController } from './controllers/tag.controller';
import { CommentController } from './controllers/comment.controller';

/**
 * Lista de controllers exportados pelo módulo.
 * O loader dinâmico importará este array e o passará para o NestJS.
 */
export const ModuleRoutes = [
    DemoController,
    CategoryController,
    TagController,
    CommentController
];
