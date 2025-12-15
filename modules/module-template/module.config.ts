/**
 * CONFIGURAÇÃO DO MÓDULO TEMPLATE
 * 
 * Template para criação de novos módulos
 * Copie esta pasta e modifique conforme necessário
 */

export const moduleConfig = {
  // Identificação obrigatória
  name: 'Module Template',
  slug: 'module-template',
  version: '1.0.0',
  
  // Status e segurança (OBRIGATÓRIO)
  enabled: false, // Desabilitado por padrão - habilite após configurar
  permissionsStrict: true,
  sandboxed: true,
  
  // Metadados opcionais
  author: 'Seu Nome',
  description: 'Template para criação de novos módulos independentes',
  category: 'Template',
  
  // Flags de segurança adicionais
  allowEval: false,
  allowWindowAccess: false,
  requiresAuth: true
} as const;