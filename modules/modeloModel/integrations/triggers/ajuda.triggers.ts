// Gatilhos para o módulo de ajuda
export const ajudaTriggers = {
  // Exemplo de gatilho que pode ser acionado quando o módulo é acessado
  onModuleAccess: {
    name: 'ajuda.module.accessed',
    description: 'Disparado quando o módulo de ajuda é acessado',
    handler: 'handleModuleAccess'
  },
  
  // Exemplo de gatilho que pode ser acionado quando informações são visualizadas
  onInfoView: {
    name: 'ajuda.info.viewed',
    description: 'Disparado quando informações do módulo são visualizadas',
    handler: 'handleInfoView'
  }
};