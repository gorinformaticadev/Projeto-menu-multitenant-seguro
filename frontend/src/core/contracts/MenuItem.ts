/**
 * Item de menu da aplicação
 */

import { Role } from './types';

/**
 * Item de menu individual
 */
export interface MenuItem {
  /** Identificador único do item */
  id: string;
  
  /** Texto apresentado ao usuário */
  label: string;
  
  /** Ícone (nome do ícone do Lucide React) */
  icon?: string;
  
  /** URL/Path de destino */
  href: string;
  
  /** Ordem de exibição (menor = primeiro) */
  order: number;
  
  /** Permissões necessárias para visualizar */
  permissions?: string[];
  
  /** Roles que podem visualizar */
  roles?: Role[];
  
  /** Módulo que registrou este item */
  module?: string;
  
  /** Subitens (menu em árvore) */
  children?: MenuItem[];
  
  /** Se o item está ativo */
  active?: boolean;
  
  /** Badge/contador (ex: notificações) */
  badge?: string | number;
}

/**
 * Grupo de menu
 */
export interface MenuGroup {
  /** Identificador do grupo */
  id: string;
  
  /** Título do grupo */
  title?: string;
  
  /** Itens do grupo */
  items: MenuItem[];
  
  /** Ordem do grupo */
  order: number;
}
