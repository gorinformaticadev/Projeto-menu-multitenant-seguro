/**
 * Contrato que todo módulo deve implementar
 * Interface mínima obrigatória para módulos da plataforma
 */

import { CoreContext } from '../context/CoreContext';

/**
 * Dependências de módulo
 */
export interface ModuleDependencies {
  /** Outros módulos necessários (identificados por slug) */
  modules?: string[];
  /** Versão mínima do CORE necessária (semantic versioning) */
  coreVersion?: string;
}

/**
 * Contrato obrigatório para todos os módulos
 */
export interface ModuleContract {
  // ==================== IDENTIFICAÇÃO (OBRIGATÓRIO) ====================
  
  /** Nome técnico único do módulo (ex: "crm", "inventory") */
  name: string;
  
  /** Identificador URL-safe (ex: "crm", "financial-module") */
  slug: string;
  
  /** Versão seguindo semantic versioning (ex: "1.2.3") */
  version: string;

  // ==================== METADADOS (OBRIGATÓRIO) ====================
  
  /** Nome apresentável ao usuário */
  displayName: string;
  
  /** Descrição curta do módulo */
  description: string;
  
  /** Autor ou organização responsável */
  author: string;

  // ==================== LIFECYCLE (OBRIGATÓRIO) ====================
  
  /**
   * Método de inicialização do módulo
   * Chamado uma única vez durante o boot do sistema
   * 
   * Dentro deste método, o módulo pode:
   * - Escutar eventos do Event Bus
   * - Registrar rotas via evento routes:register
   * - Adicionar itens ao MenuManager
   * - Registrar widgets no DashboardManager
   * - Configurar permissões via ACLManager
   * - Inicializar serviços internos
   * 
   * @param context - Contexto global do CORE
   */
  boot(context: CoreContext): Promise<void> | void;

  // ==================== LIFECYCLE (OPCIONAL) ====================
  
  /**
   * Método de shutdown do módulo
   * Chamado durante desligamento gracioso do sistema
   * 
   * Use para:
   * - Fechar conexões
   * - Limpar recursos
   * - Salvar estado
   */
  shutdown?(): Promise<void> | void;

  // ==================== DEPENDÊNCIAS (OPCIONAL) ====================
  
  /** Dependências do módulo */
  dependencies?: ModuleDependencies;

  // ==================== CONFIGURAÇÃO (OPCIONAL) ====================
  
  /** Indica se o módulo está habilitado por padrão */
  enabled?: boolean;
  
  /** Configurações padrão do módulo */
  defaultConfig?: Record<string, any>;
}

/**
 * Informações de módulo registrado no sistema
 */
export interface RegisteredModule extends ModuleContract {
  /** Status de carregamento do módulo */
  status: 'loading' | 'active' | 'error' | 'disabled';
  
  /** Erro de carregamento (se houver) */
  error?: Error;
  
  /** Timestamp de registro */
  registeredAt: Date;
  
  /** Timestamp de última atualização */
  updatedAt: Date;
}
