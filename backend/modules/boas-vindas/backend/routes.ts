import { Module } from '@nestjs/common';

// Este módulo é frontend-only, sem rotas backend
export const ModuleRoutes = [];

// Módulo vazio para compatibilidade
@Module({})
export class BoasVindasBackendModule {}