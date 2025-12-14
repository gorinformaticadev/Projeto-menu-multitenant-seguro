/**
 * PÁGINA PRINCIPAL DO MODULE TEMPLATE
 * 
 * Módulo para criação de páginas de módulos independentes
 * JavaScript puro, sem dependências externas
 */

function ModuleMóduloPage() {
  // Inicializar o ModuleCore se disponível
  let core = null;
  let bridge = null;
  
  console.log('🔍 [Módulo] Verificando disponibilidade do sistema...');
  
  if (typeof window !== 'undefined' && window.ModuleCore) {
    core = window.ModuleCore;
    console.log('✅ [Módulo] ModuleCore encontrado');
    
    // Tentar inicializar com o bridge do sistema
    if (typeof ModuleBridge !== 'undefined') {
      core.init(ModuleBridge);
      bridge = core.getBridge();
      console.log('🔧 [Módulo] Módulo inicializado com bridge do sistema');
    } else {
      bridge = core.getBridge(); // Usará fallback
      console.log('🔧 [Módulo] Módulo inicializado com bridge de fallback');
    }
  } else {
    console.log('⚠️ [Módulo] ModuleCore não encontrado, usando modo básico');
  }
  
  // Função para criar elementos (usa bridge se disponível)
  const createElement = bridge ? bridge.createElement : (tag, props = {}, ...children) => {
    const element = document.createElement(tag);
    
    // Aplicar propriedades
    Object.entries(props).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key.startsWith('on') && typeof value === 'function') {
        element.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === 'innerHTML') {
        element.innerHTML = value;
      } else {
        element.setAttribute(key, value);
      }
    });
    
    // Adicionar filhos
    children.forEach(child => {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else if (child instanceof HTMLElement) {
        element.appendChild(child);
      }
    });
    
    return element;
  };

  // Renderizar o componente
  const render = () => {
    const container = createElement('div', { 
      className: 'container mx-auto py-6 px-4 max-w-4xl' 
    });
    
    // Header
    const header = createElement('div', { className: 'mb-6' });
    const headerContent = createElement('div', { className: 'flex items-center gap-3 mb-2' });
    
    const iconDiv = createElement('div', { className: 'p-2 bg-purple-100 rounded-lg' });
    const icon = createElement('div', { 
      className: 'h-6 w-6 text-purple-600',
      innerHTML: '📄'
    });
    iconDiv.appendChild(icon);
    
    const textDiv = createElement('div');
    const title = createElement('h1', { className: 'text-2xl font-bold text-gray-900' }, 'Módulo Exemplo Novo');
    const subtitle = createElement('p', { className: 'text-gray-600' }, 'Módulo para criação de módulos independentes');
    textDiv.appendChild(title);
    textDiv.appendChild(subtitle);
    
    headerContent.appendChild(iconDiv);
    headerContent.appendChild(textDiv);
    
    const badges = createElement('div', { className: 'flex items-center gap-2' });
    const mduloexemplonovoBadge = createElement('span', { 
      className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800'
    }, 'Módulo');
    const versionBadge = createElement('span', { 
      className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800'
    }, 'v1.0.0');
    badges.appendChild(mduloexemplonovoBadge);
    badges.appendChild(versionBadge);
    
    header.appendChild(headerContent);
    header.appendChild(badges);
    
    // Instruções de uso
    const instructionsCard = bridge ? bridge.createCard(
      '📋 Instruções de Uso',
      ''
    ) : createElement('div', { className: 'bg-white shadow overflow-hidden sm:rounded-lg mb-6' });
    
    const instructionsContent = createElement('div', { className: 'space-y-4' });
    
    const steps = [
      '1. Copie a pasta m-dulo-exemplo-novo para um novo nome (ex: module-meumodulo)',
      '2. Edite module.config.ts com as informações do seu módulo',
      '3. Atualize module.pages.ts com as rotas do seu módulo',
      '4. Modifique module.bootstrap.ts com menus e permissões',
      '5. Implemente suas páginas em frontend/pages/',
      '6. Habilite o módulo alterando enabled: true na configuração'
    ];
    
    steps.forEach(step => {
      const stepEl = createElement('div', { className: 'flex items-start gap-3 p-3 bg-gray-50 rounded-lg' });
      const stepIcon = createElement('div', { className: 'flex-shrink-0 mt-0.5' });
      const stepIconSpan = createElement('span', { className: 'h-5 w-5 text-blue-600' }, '📌');
      stepIcon.appendChild(stepIconSpan);
      
      const stepText = createElement('div', { className: 'text-sm text-gray-700' }, step);
      
      stepEl.appendChild(stepIcon);
      stepEl.appendChild(stepText);
      instructionsContent.appendChild(stepEl);
    });
    
    // Adicionar ao card
    if (bridge) {
      const cardContent = instructionsCard.querySelector('.px-4');
      if (cardContent) {
        cardContent.appendChild(instructionsContent);
      }
    } else {
      const instructionsHeader = createElement('div', { className: 'px-4 py-5 sm:p-6' });
      const instructionsTitle = createElement('h3', { 
        className: 'text-lg leading-6 font-medium text-gray-900 mb-4 flex items-center gap-2' 
      });
      const instructionsIcon = createElement('span', { className: 'h-5 w-5' }, '📋');
      const instructionsTitleText = createElement('span', {}, 'Instruções de Uso');
      instructionsTitle.appendChild(instructionsIcon);
      instructionsTitle.appendChild(instructionsTitleText);
      
      instructionsHeader.appendChild(instructionsTitle);
      instructionsHeader.appendChild(instructionsContent);
      instructionsCard.appendChild(instructionsHeader);
    }
    
    // Exemplo de funcionalidade
    const exampleCard = bridge ? bridge.createCard(
      '🧪 Exemplo de Funcionalidade',
      ''
    ) : createElement('div', { className: 'bg-white shadow overflow-hidden sm:rounded-lg mb-6' });
    
    const exampleContent = createElement('div', { className: 'space-y-4' });
    
    const description = createElement('p', { 
      className: 'text-sm text-gray-600 mb-4' 
    }, 'Este é um exemplo de como implementar funcionalidades no seu módulo.');
    
    // Campo de entrada
    const inputField = createElement('div');
    const inputLabel = createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Exemplo de Input');
    const inputEl = createElement('input', { 
      type: 'text',
      className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500',
      placeholder: 'Digite algo aqui...',
      id: 'example-input'
    });
    inputField.appendChild(inputLabel);
    inputField.appendChild(inputEl);
    
    // Botão de ação
    const actionButton = bridge ? bridge.createButton('🚀 Executar Ação', () => {
      const input = document.getElementById('example-input');
      const value = input ? input.value : '';
      
      if (!value) {
        bridge.showNotification('Aviso', 'Digite algo no campo acima', 'warning');
        return;
      }
      
      bridge.showNotification('Sucesso', `Ação executada com: "${value}"`, 'success');
      
      // Limpar campo
      if (input) input.value = '';
      
    }, 'primary') : createElement('button', { 
      className: 'px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors',
      onclick: () => {
        const input = document.getElementById('example-input');
        const value = input ? input.value : '';
        
        if (!value) {
          alert('⚠️ Digite algo no campo acima');
          return;
        }
        
        alert(`✅ Ação executada com: "${value}"`);
        
        if (input) input.value = '';
      }
    }, '🚀 Executar Ação');
    
    exampleContent.appendChild(description);
    exampleContent.appendChild(inputField);
    exampleContent.appendChild(actionButton);
    
    // Adicionar ao card
    if (bridge) {
      const cardContent = exampleCard.querySelector('.px-4');
      if (cardContent) {
        cardContent.appendChild(exampleContent);
      }
    } else {
      const exampleHeader = createElement('div', { className: 'px-4 py-5 sm:p-6' });
      const exampleTitle = createElement('h3', { 
        className: 'text-lg leading-6 font-medium text-gray-900 mb-4 flex items-center gap-2' 
      });
      const exampleIcon = createElement('span', { className: 'h-5 w-5' }, '🧪');
      const exampleTitleText = createElement('span', {}, 'Exemplo de Funcionalidade');
      exampleTitle.appendChild(exampleIcon);
      exampleTitle.appendChild(exampleTitleText);
      
      exampleHeader.appendChild(exampleTitle);
      exampleHeader.appendChild(exampleContent);
      exampleCard.appendChild(exampleHeader);
    }
    
    // Informações do sistema
    const statusMessage = bridge && core && core.isReady() ? 
      'Sistema Integrado - Módulo funcionando com bridge do sistema' :
      'Modo Independente - Módulo funcionando sem dependências externas';
      
    const statusType = bridge && core && core.isReady() ? 'success' : 'info';
    
    const infoBox = bridge ? bridge.createAlert(statusMessage, statusType) : 
      createElement('div', { className: 'mt-6 bg-purple-50 border border-purple-200 rounded-lg p-4' });
    
    if (!bridge) {
      const infoHeader = createElement('div', { className: 'flex' });
      
      const infoIcon = createElement('div', { className: 'flex-shrink-0' });
      const infoIconSpan = createElement('span', { className: 'h-5 w-5 text-purple-400' }, 'ℹ️');
      infoIcon.appendChild(infoIconSpan);
      
      const infoContent = createElement('div', { className: 'ml-3' });
      const infoTitle = createElement('h3', { className: 'text-sm font-medium text-purple-800' }, 'Módulo Módulo');
      const infoText = createElement('p', { className: 'mt-2 text-sm text-purple-700' }, statusMessage);
      
      infoContent.appendChild(infoTitle);
      infoContent.appendChild(infoText);
      infoHeader.appendChild(infoIcon);
      infoHeader.appendChild(infoContent);
      infoBox.appendChild(infoHeader);
    }
    
    // Montar tudo
    container.appendChild(header);
    container.appendChild(instructionsCard);
    container.appendChild(exampleCard);
    container.appendChild(infoBox);
    
    return container;
  };

  return {
    render
  };
}

// Exportar para uso no sistema de roteamento
if (typeof window !== 'undefined') {
  window.ModuleMóduloPage = ModuleMóduloPage;
}