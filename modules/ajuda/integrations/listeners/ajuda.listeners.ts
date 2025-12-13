// Listeners para o módulo de ajuda
export const ajudaListeners = {
  // Exemplo de listener que pode ouvir eventos de outros módulos
  onUserLogin: {
    event: 'user.logged.in',
    action: 'trackModuleAccess',
    description: 'Ouve eventos de login de usuário para rastrear acesso ao módulo'
  },
  
  onSystemUpdate: {
    event: 'system.updated',
    action: 'refreshModuleInfo',
    description: 'Ouve eventos de atualização do sistema para atualizar informações'
  }
};