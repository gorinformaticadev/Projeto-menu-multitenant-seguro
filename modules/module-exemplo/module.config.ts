/**
 * CONFIGURAÇÃO DO MÓDULO DE EXEMPLO
 * 
 * Este arquivo define as configurações e metadados do módulo
 * Seguindo o padrão do sistema de módulos robusto e independente
 */

export const moduleConfig = {
  // Identificação obrigatória
  name: 'Module Exemplo',
  slug: 'module-exemplo',
  version: '1.0.0',
  
  // Status e segurança (OBRIGATÓRIO)
  enabled: true,
  permissionsStrict: true,
  sandboxed: true,
  
  // Metadados opcionais
  author: 'Sistema Core',
  description: 'Módulo de exemplo para demonstração do sistema modular robusto',
  category: 'Exemplo',
  
  // Flags de segurança adicionais
  allowEval: false,
  allowWindowAccess: false,
  requiresAuth: true
} as const;