/**
 * Widget de Dashboard
 */

import { Role } from './types';

/**
 * Tamanho do widget
 */
export type WidgetSize = 'small' | 'medium' | 'large' | 'full';

/**
 * Widget de dashboard
 */
export interface DashboardWidget {
  /** Identificador único do widget */
  id: string;
  
  /** Título apresentado */
  title: string;
  
  /** Nome do componente a ser renderizado */
  component: string;
  
  /** Tamanho do widget */
  size: WidgetSize;
  
  /** Ordem de exibição */
  order: number;
  
  /** Permissões necessárias */
  permissions?: string[];
  
  /** Roles que podem visualizar */
  roles?: Role[];
  
  /** Módulo que registrou este widget */
  module?: string;
  
  /** Intervalo de atualização automática (ms) */
  refresh?: number;
  
  /** Propriedades customizadas para o componente */
  props?: Record<string, any>;
  
  /** Se o widget pode ser fechado pelo usuário */
  closeable?: boolean;
  
  /** Se o widget pode ser movido */
  draggable?: boolean;
}
