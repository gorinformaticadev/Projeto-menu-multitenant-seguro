/**
 * CONFIGURAÇÃO DO MÓDULO TEMPLATE
 * 
 * Módulo para criação de novos módulos
 * Copie esta pasta e modifique conforme necessário
 */

export const moduleConfig = {
  // Identificação obrigatória
  name: 'Módulo Exemplo Novo',
  slug: 'm-dulo-exemplo-novo',
  version: '1.0.0',
  
  // Status e segurança (OBRIGATÓRIO)
  enabled: true, // Desabilitado por padrão - habilite após configurar
  permissionsStrict: true,
  sandboxed: true,
  
  // Metadados opcionais
  author: 'Sistema Automático',
  description: 'Módulo criado automaticamente para demonstração',
  category: 'Módulo',
  
  // Flags de segurança adicionais
  allowEval: false,
  allowWindowAccess: false,
  requiresAuth: true
} as const;