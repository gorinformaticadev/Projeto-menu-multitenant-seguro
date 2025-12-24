import React from 'react';
import { FrontendModuleDefinition } from '@/lib/module-types';
import { SistemaWidget } from './components/SistemaWidget';

/**
 * Definição do Módulo Sistema (Frontend)
 * 
 * Esta estrutura segue o contrato FrontendModuleDefinition e é usada
 * pelo ModuleRegistry para integrar o módulo à aplicação principal.
 * 
 * Capacidades declaradas:
 * - Widgets: Cards interativos para o dashboard
 * - Routes: Rotas customizadas (futuro)
 * - NavItems: Itens de menu lateral (futuro)
 */
export const SistemaModule: FrontendModuleDefinition = {
    // Identificador único do módulo (deve bater com o slug do backend)
    id: 'sistema',

    // Nome legível para exibição
    name: 'Sistema',

    // Lista de widgets que este módulo contribui para o Dashboard
    widgets: [
        {
            id: 'sistema-status',          // ID único do widget
            type: 'summary_card',          // Tipo de visualização
            title: 'Status do Sistema',    // Título do card
            component: SistemaWidget,      // O componente React real a ser renderizado
            gridSize: { w: 1, h: 1 },      // Tamanho na grid (largura x altura)
            order: 1,                      // Ordem de prioridade na exibição
            icon: 'Activity'               // Nome do ícone (Lucide)
        }
    ]
};
