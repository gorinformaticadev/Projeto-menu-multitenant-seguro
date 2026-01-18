/**
 * DashboardManager - Gerenciador de widgets do dashboard
 * Agrega contribuições de módulos e filtra por permissões
 */

import { DashboardWidget } from '../contracts/DashboardWidget';
import { User } from '../contracts/types';

/**
 * Gerenciador de dashboard
 */
export class DashboardManager {
  private widgets: DashboardWidget[] = [];

  /**
   * Adiciona um widget ao dashboard
   * @param widget - Widget a adicionar
   */
  public addWidget(widget: DashboardWidget): void {
    // Verificar se widget já existe
    const existingIndex = this.widgets.findIndex(w => w.id === widget.id);
    
    if (existingIndex >= 0) {
      // Substituir widget existente
      this.widgets[existingIndex] = widget;
      console.warn(`Dashboard widget "${widget.id}" substituído`);
    } else {
      // Adicionar novo widget
      this.widgets.push(widget);
    }
  }

  /**
   * Remove um widget do dashboard
   * @param id - ID do widget a remover
   * @returns true se removido com sucesso
   */
  public removeWidget(id: string): boolean {
    const initialLength = this.widgets.length;
    this.widgets = this.widgets.filter(widget => widget.id !== id);
    return this.widgets.length < initialLength;
  }

  /**
   * Obtém todos os widgets filtrados por permissões do usuário
   * @param user - Usuário atual (null para público)
   * @returns Lista de widgets filtrados e ordenados
   */
  public getWidgets(user: User | null): DashboardWidget[] {
    return this.widgets
      .filter(widget => this.userCanView(widget, user))
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Obtém widgets por tamanho
   * @param size - Tamanho desejado
   * @param user - Usuário atual
   * @returns Widgets filtrados por tamanho
   */
  public getWidgetsBySize(size: DashboardWidget['size'], user: User | null): DashboardWidget[] {
    return this.getWidgets(user).filter(w => w.size === size);
  }

  /**
   * Obtém widgets por módulo
   * @param moduleSlug - Slug do módulo
   * @param user - Usuário atual
   * @returns Widgets do módulo
   */
  public getWidgetsByModule(moduleSlug: string, user: User | null): DashboardWidget[] {
    return this.getWidgets(user).filter(w => w.module === moduleSlug);
  }

  /**
   * Limpa todos os widgets
   */
  public clear(): void {
    this.widgets = [];
  }

  /**
   * Retorna quantidade de widgets
   */
  public count(): number {
    return this.widgets.length;
  }

  /**
   * Verifica se usuário pode visualizar um widget
   * @param widget - Widget
   * @param user - Usuário
   * @returns true se pode visualizar
   */
  private userCanView(widget: DashboardWidget, user: User | null): boolean {
    // Se widget não especifica permissões ou roles, é público
    if (!widget.permissions && !widget.roles) {
      return true;
    }

    // Se não há usuário, não pode ver widgets protegidos
    if (!user) {
      return false;
    }

    // Verificar roles
    if (widget.roles && widget.roles.length > 0) {
      if (!widget.roles.includes(user.role)) {
        return false;
      }
    }

    // Verificar permissões
    if (widget.permissions && widget.permissions.length > 0) {
      const hasPermission = widget.permissions.some(permission =>
        user.permissions.includes(permission)
      );
      
      if (!hasPermission) {
        return false;
      }
    }

    return true;
  }

  /**
   * Debug - lista todos os widgets
   */
  public debug(): void {
    console.log(`Total widgets: ${this.count()}`);
    this.widgets
      .sort((a, b) => a.order - b.order)
      .forEach(widget => {
        console.log(`  [${widget.order}] ${widget.title} (${widget.id})`);
        if (widget.permissions || widget.roles) {
          console.log(`      Permissions: ${widget.permissions?.join(', ') || 'none'}`);
          console.log(`      Roles: ${widget.roles?.join(', ') || 'none'}`);
        }
        if (widget.refresh) {
      // Empty implementation
    }
      });
  }
}
