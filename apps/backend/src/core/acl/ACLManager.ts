/**
 * ACLManager - Gerenciador de ACL (Access Control List)
 * Gerencia roles, permissões e verificações de acesso
 */

import { User, Permission } from '../contracts/types';

/**
 * Definição de Role com permissões
 */
export interface RoleDefinition {
  name: string;
  permissions: string[];
  description?: string;
}

/**
 * Gerenciador de ACL
 */
export class ACLManager {
  private roles: Map<stringDefinition> = new Map();
  private permissions: Map<string, Permission> = new Map();

  constructor() {
    // Inicializar roles padrão
    this.initializeDefaultRoles();
  }

  /**
   * Inicializa roles padrão do sistema
   */
  private initializeDefaultRoles(): void {
    // SUPER_ADMIN - acesso total
    this.registerRole('SUPER_ADMIN', ['*'], 'Administrador do sistema com acesso total');

    // ADMIN - administração de tenant
    this.registerRole('ADMIN', [
      'users.view',
      'users.create',
      'users.edit',
      'users.delete',
      'settings.view',
      'settings.edit',
    ], 'Administrador do tenant');

    // USER - usuário padrão
    this.registerRole('USER', [
      'dashboard.view',
      'profile.view',
      'profile.edit',
    ], 'Usuário padrão');

    // CLIENT - cliente externo
    this.registerRole('CLIENT', [
      'profile.view',
      'profile.edit',
    ], 'Cliente externo');
  }

  /**
   * Registra uma nova role
   * @param name - Nome da role
   * @param permissions - Permissões da role
   * @param description - Descrição opcional
   */
  public registerRole(name: string, permissions: string[], description?: string): void {
    this.roles.set(name, {
      name,
      permissions,
      description,
    });
  }

  /**
   * Registra uma nova permissão
   * @param name - Nome da permissão (ex: "users.create")
   * @param description - Descrição da permissão
   * @param module - Módulo que registrou a permissão
   */
  public registerPermission(name: string, description: string, module?: string): void {
    this.permissions.set(name, {
      id: name,
      name,
      description,
      module,
    });
  }

  /**
   * Adiciona permissões a uma role existente
   * @param roleName - Nome da role
   * @param permissions - Permissões a adicionar
   */
  public addPermissionsToRole(roleName: string, permissions: string[]): void {
    const role = this.roles.get(roleName);
    
    if (!role) {
      throw new Error(`Role "${roleName}" não encontrada`);
    }

    // Adicionar novas permissões sem duplicar
    const uniquePermissions = new Set([...role.permissions, ...permissions]);
    role.permissions = Array.from(uniquePermissions);
  }

  /**
   * Remove permissões de uma role
   * @param roleName - Nome da role
   * @param permissions - Permissões a remover
   */
  public removePermissionsFromRole(roleName: string, permissions: string[]): void {
    const role = this.roles.get(roleName);
    
    if (!role) {
      throw new Error(`Role "${roleName}" não encontrada`);
    }

    role.permissions = role.permissions.filter(p => !permissions.includes(p));
  }

  /**
   * Verifica se usuário tem uma permissão específica
   * @param user - Usuário a verificar
   * @param permission - Permissão necessária
   * @returns true se usuário tem a permissão
   */
  public userHasPermission(user: User | null, permission: string): boolean {
    if (!user) {
      return false;
    }

    // SUPER_ADMIN tem todas as permissões
    if (user.role === Role.SUPER_ADMIN) {
      return true;
    }

    // Verificar permissões diretas do usuário
    if (user.permissions && user.permissions.includes(permission)) {
      return true;
    }

    // Verificar permissões da role
    const role = this.roles.get(user.role);
    if (role) {
      // Verificar wildcard (*)
      if (role.permissions.includes('*')) {
        return true;
      }

      // Verificar permissão específica
      if (role.permissions.includes(permission)) {
        return true;
      }

      // Verificar wildcards parciais (ex: "users.*" permite "users.create")
      const hasWildcard = role.permissions.some(p => {
        if (p.endsWith('.*')) {
          const prefix = p.slice(0, -2);
          return permission.startsWith(prefix + '.');
        }
        return false;
      });

      if (hasWildcard) {
        return true;
      }
    }

    return false;
  }

  /**
   * Verifica se usuário tem uma role específica
   * @param user - Usuário a verificar
   * @param role - Role necessária
   * @returns true se usuário tem a role
   */
  public userHasRole(user: User | null, role: string): boolean {
    if (!user) {
      return false;
    }

    return user.role === role;
  }

  /**
   * Verifica se usuário tem qualquer uma das roles especificadas
   * @param user - Usuário a verificar
   * @param roles - Roles aceitas
   * @returns true se usuário tem alguma das roles
   */
  public userHasAnyRole(user: User | null, roles: string[]): boolean {
    if (!user) {
      return false;
    }

    return roles.includes(user.role);
  }

  /**
   * Filtra itens baseado em permissões do usuário
   * @param items - Itens a filtrar
   * @param user - Usuário atual
   * @returns Itens filtrados
   */
  public filterByPermission<T extends { permissions?: string[] }>(
    items: T[],
    user: User | null
  ): T[] {
    return items.filter(item => {
      // Se item não tem permissões, é público
      if (!item.permissions || item.permissions.length === 0) {
        return true;
      }

      // Se não há usuário, não pode ver itens protegidos
      if (!user) {
        return false;
      }

      // Verificar se usuário tem alguma das permissões necessárias
      return item.permissions.some(permission =>
        this.userHasPermission(user, permission)
      );
    });
  }

  /**
   * Obtém todas as permissões de um usuário (role + permissões diretas)
   * @param user - Usuário
   * @returns Lista de permissões
   */
  public getUserPermissions(user: User | null): string[] {
    if (!user) {
      return [];
    }

    const permissions = new Set<string>();

    // Adicionar permissões diretas
    if (user.permissions) {
      user.permissions.forEach(p => permissions.add(p));
    }

    // Adicionar permissões da role
    const role = this.roles.get(user.role);
    if (role) {
      role.permissions.forEach(p => permissions.add(p));
    }

    return Array.from(permissions);
  }

  /**
   * Obtém definição de uma role
   * @param name - Nome da role
   */
  public getRole(name: string): RoleDefinition | undefined {
    return this.roles.get(name);
  }

  /**
   * Obtém todas as roles registradas
   */
  public getRoles(): RoleDefinition[] {
    return Array.from(this.roles.values());
  }

  /**
   * Obtém uma permissão
   * @param name - Nome da permissão
   */
  public getPermission(name: string): Permission | undefined {
    return this.permissions.get(name);
  }

  /**
   * Obtém todas as permissões registradas
   */
  public getPermissions(): Permission[] {
    return Array.from(this.permissions.values());
  }

  /**
   * Obtém permissões por módulo
   * @param moduleSlug - Slug do módulo
   */
  public getPermissionsByModule(moduleSlug: string): Permission[] {
    return this.getPermissions().filter(p => p.module === moduleSlug);
  }

  /**
   * Debug - lista roles e permissões
   */
  public debug(): void {
    this.roles.forEach((role, _name) => {
      if (role.description) {
      // Empty implementation
    }
      console.log(`    Permissions: ${role.permissions.join(', ')}`);
    });

    this.permissions.forEach((permission, _name) => {
      if (permission.module) {
      // Empty implementation
    }
    });
  }
}
