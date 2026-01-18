/**
 * MenuManager - Gerenciador de menus da aplicação
 * Agrega contribuições de módulos e filtra por permissões
 */

import { MenuItem, MenuGroup } from '../contracts/MenuItem';
import { User } from '../contracts/types';

/**
 * Gerenciador de menus
 */
export class MenuManager {
  private items: MenuItem[] = [];

  /**
   * Adiciona um item ao menu
   * @param item - Item de menu a adicionar
   */
  public add(item: MenuItem): void {
    // Verificar se item já existe
    const existingIndex = this.items.findIndex(i => i.id === item.id);
    
    if (existingIndex >= 0) {
      // Substituir item existente
      this.items[existingIndex] = item;
      console.warn(`Menu item "${item.id}" substituído`);
    } else {
      // Adicionar novo item
      this.items.push(item);
    }
  }

  /**
   * Remove um item do menu
   * @param id - ID do item a remover
   * @returns true se removido com sucesso
   */
  public remove(id: string): boolean {
    const initialLength = this.items.length;
    this.items = this.items.filter(item => item.id !== id);
    return this.items.length < initialLength;
  }

  /**
   * Obtém todos os itens de menu filtrados por permissões do usuário
   * @param user - Usuário atual (null para público)
   * @returns Lista de itens filtrados e ordenados
   */
  public getItems(user: User | null): MenuItem[] {
    return this.items
      .filter(item => this.userCanView(item, user))
      .sort((a, b) => a.order - b.order)
      .map(item => ({
        ...item,
        children: item.children
          ?.filter(child => this.userCanView(child, user))
          .sort((a, b) => a.order - b.order),
      }));
  }

  /**
   * Obtém itens agrupados
   * @param user - Usuário atual
   * @returns Itens organizados em grupos
   */
  public getGroupedItems(user: User | null): MenuGroup[] {
    const items = this.getItems(user);
    const groups = new Map<string, MenuItem[]>();

    // Agrupar itens (implementação simples - pode ser expandida)
    items.forEach(item => {
      const groupId = item.module || 'default';
      
      if (!groups.has(groupId)) {
        groups.set(groupId, []);
      }
      
      groups.get(groupId)!.push(item);
    });

    // Converter para array de grupos
    return Array.from(groups.entries()).map(([id, items], index) => ({
      id,
      items,
      order: index,
    }));
  }

  /**
   * Limpa todos os itens do menu
   */
  public clear(): void {
    this.items = [];
  }

  /**
   * Retorna quantidade de itens no menu
   */
  public count(): number {
    return this.items.length;
  }

  /**
   * Verifica se usuário pode visualizar um item
   * @param item - Item de menu
   * @param user - Usuário
   * @returns true se pode visualizar
   */
  private userCanView(item: MenuItem, user: User | null): boolean {
    // Se item não especifica permissões ou roles, é público
    if (!item.permissions && !item.roles) {
      return true;
    }

    // Se não há usuário, não pode ver itens protegidos
    if (!user) {
      return false;
    }

    // Verificar roles
    if (item.roles && item.roles.length > 0) {
      if (!item.roles.includes(user.role)) {
        return false;
      }
    }

    // Verificar permissões
    if (item.permissions && item.permissions.length > 0) {
      const hasPermission = item.permissions.some(permission =>
        user.permissions.includes(permission)
      );
      
      if (!hasPermission) {
        return false;
      }
    }

    return true;
  }

  /**
   * Debug - lista todos os itens
   */
  public debug(): void {
    console.log(`Total items: ${this.count()}`);
    this.items
      .sort((a, b) => a.order - b.order)
      .forEach(item => {
        console.log(`  [${item.order}] ${item.label} (${item.id})`);
        if (item.permissions || item.roles) {
          console.log(`      Permissions: ${item.permissions?.join(', ') || 'none'}`);
          console.log(`      Roles: ${item.roles?.join(', ') || 'none'}`);
        }
        if (item.children && item.children.length > 0) {
          item.children.forEach(child => {
      // Empty implementation
    });
        }
      });
  }
}
