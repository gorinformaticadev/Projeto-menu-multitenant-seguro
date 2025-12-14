/**
 * CONFIGURAÇÃO DO MÓDULO TEMPLATE
 * 
 * Módulo para criação de novos módulos
 * Copie esta pasta e modifique conforme necessário
 */

export const moduleConfig = {
  // Identificação obrigatória
  name: 'Sistema de Vendas',
  slug: 'sistema-de-vendas',
  version: '1.0.0',
  
  // Status e segurança (OBRIGATÓRIO)
  enabled: true, // Desabilitado por padrão - habilite após configurar
  permissionsStrict: true,
  sandboxed: true,
  
  // Metadados opcionais
  author: 'Equipe Dev',
  description: 'Módulo para gerenciar vendas e clientes',
  category: 'Módulo',
  
  // Flags de segurança adicionais
  allowEval: false,
  allowWindowAccess: false,
  requiresAuth: true
} as const;