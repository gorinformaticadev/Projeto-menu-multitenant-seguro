/**
 * CONFIGURAÇÃO DO MÓDULO DE EXEMPLO
 * 
 * Este arquivo define as configurações e metadados do módulo
 */

export const moduleConfig = {
  // Identificação do módulo
  id: 'module-exemplo',
  name: 'Module Exemplo',
  version: '1.0.0',
  description: 'Módulo de exemplo para demonstração do sistema modular',
  
  // Configurações de ativação
  enabled: true,
  requiresActivation: true, // Requer ativação por empresa
  
  // Metadados
  author: 'Sistema Core',
  category: 'Exemplo',
  
  // Rotas do módulo
  routes: {
    base: '/module-exemplo',
    pages: {
      index: '/module-exemplo',
      settings: '/module-exemplo/settings'
    }
  },
  
  // Permissões necessárias
  permissions: [
    'module-exemplo.view',
    'module-exemplo.manage'
  ]
} as const;