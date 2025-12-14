/**
 * PÁGINA DE CONFIGURAÇÕES DO MODULE EXEMPLO
 * 
 * Versão standalone do módulo - completamente independente
 * JavaScript puro, sem dependências externas
 */

function ModuleExemploSettingsPage() {
  // Função helper para criar elementos sem JSX
  const createElement = (tag, props = {}, ...children) => {
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
    
    const iconDiv = createElement('div', { className: 'p-2 bg-gray-100 rounded-lg' });
    const icon = createElement('div', { 
      className: 'h-6 w-6 text-gray-600',
      innerHTML: '⚙️'
    });
    iconDiv.appendChild(icon);
    
    const textDiv = createElement('div');
    const title = createElement('h1', { className: 'text-2xl font-bold text-gray-900' }, 'Configurações do Module Exemplo');
    const subtitle = createElement('p', { className: 'text-gray-600' }, 'Configurações do módulo de exemplo (demonstração)');
    textDiv.appendChild(title);
    textDiv.appendChild(subtitle);
    
    headerContent.appendChild(iconDiv);
    headerContent.appendChild(textDiv);
    
    const badges = createElement('div', { className: 'flex items-center gap-2' });
    const demoBadge = createElement('span', { 
      className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800'
    }, 'Página de Demonstração');
    badges.appendChild(demoBadge);
    
    header.appendChild(headerContent);
    header.appendChild(badges);
    
    // Configurações Mock
    const configGrid = createElement('div', { className: 'grid gap-6 md:grid-cols-2 mb-6' });
    
    // Card de Configurações Gerais
    const configCard = createElement('div', { className: 'bg-white shadow overflow-hidden sm:rounded-lg' });
    const configHeader = createElement('div', { className: 'px-4 py-5 sm:p-6' });
    const configTitle = createElement('h3', { className: 'text-lg leading-6 font-medium text-gray-900 mb-4 flex items-center gap-2' });
    
    const configIcon = createElement('span', { className: 'h-5 w-5 text-gray-500' }, 'ℹ️');
    const configTitleText = createElement('span', {}, 'Configurações Gerais');
    configTitle.appendChild(configIcon);
    configTitle.appendChild(configTitleText);
    
    const configDesc = createElement('p', { className: 'text-sm text-gray-600 mb-6' }, 'Configurações básicas do módulo (simulação)');
    
    const configForm = createElement('div', { className: 'space-y-4' });
    
    // Campo Nome
    const nameField = createElement('div');
    const nameLabel = createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Nome do Módulo');
    const nameValue = createElement('div', { className: 'p-3 bg-gray-50 rounded-md border' });
    const nameText = createElement('span', { className: 'text-sm text-gray-900' }, 'Module Exemplo');
    nameValue.appendChild(nameText);
    nameField.appendChild(nameLabel);
    nameField.appendChild(nameValue);
    
    // Campo Versão
    const versionField = createElement('div');
    const versionLabel = createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Versão');
    const versionValue = createElement('div', { className: 'p-3 bg-gray-50 rounded-md border' });
    const versionText = createElement('span', { className: 'text-sm text-gray-900' }, '1.0.0');
    versionValue.appendChild(versionText);
    versionField.appendChild(versionLabel);
    versionField.appendChild(versionValue);
    
    // Campo Status
    const statusField = createElement('div');
    const statusLabel = createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Status');
    const statusValue = createElement('div', { className: 'p-3 bg-gray-50 rounded-md border' });
    const statusBadge = createElement('span', { 
      className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800'
    }, 'Ativo e Funcionando');
    statusValue.appendChild(statusBadge);
    statusField.appendChild(statusLabel);
    statusField.appendChild(statusValue);
    
    configForm.appendChild(nameField);
    configForm.appendChild(versionField);
    configForm.appendChild(statusField);
    
    configHeader.appendChild(configTitle);
    configHeader.appendChild(configDesc);
    configHeader.appendChild(configForm);
    configCard.appendChild(configHeader);
    
    // Card de Ações
    const actionsCard = createElement('div', { className: 'bg-white shadow overflow-hidden sm:rounded-lg' });
    const actionsHeader = createElement('div', { className: 'px-4 py-5 sm:p-6' });
    const actionsTitle = createElement('h3', { className: 'text-lg leading-6 font-medium text-gray-900 mb-4' }, 'Ações Disponíveis');
    const actionsDesc = createElement('p', { className: 'text-sm text-gray-600 mb-6' }, 'Operações que podem ser realizadas (mock)');
    
    const actionsButtons = createElement('div', { className: 'space-y-3' });
    
    // Botão Salvar
    const saveButton = createElement('button', { 
      className: 'w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700',
      onclick: () => alert('Configurações salvas (simulação)')
    });
    const saveIcon = createElement('span', { className: 'mr-2' }, '💾');
    const saveText = createElement('span', {}, 'Salvar Configurações (Mock)');
    saveButton.appendChild(saveIcon);
    saveButton.appendChild(saveText);
    
    // Botão Restaurar
    const restoreButton = createElement('button', { 
      className: 'w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50',
      onclick: () => alert('Configurações restauradas (simulação)')
    });
    const restoreIcon = createElement('span', { className: 'mr-2' }, '🔄');
    const restoreText = createElement('span', {}, 'Restaurar Padrões (Mock)');
    restoreButton.appendChild(restoreIcon);
    restoreButton.appendChild(restoreText);
    
    // Aviso
    const warning = createElement('div', { className: 'pt-4 border-t border-gray-200' });
    const warningContent = createElement('div', { className: 'flex items-start' });
    const warningIcon = createElement('div', { className: 'flex-shrink-0' });
    const warningIconSpan = createElement('span', { className: 'h-5 w-5 text-yellow-400' }, '⚠️');
    warningIcon.appendChild(warningIconSpan);
    
    const warningText = createElement('div', { className: 'ml-3' });
    const warningP = createElement('p', { className: 'text-xs text-gray-600' }, 
      'Esta é uma página de demonstração. As configurações são apenas para validação visual do sistema modular.'
    );
    warningText.appendChild(warningP);
    
    warningContent.appendChild(warningIcon);
    warningContent.appendChild(warningText);
    warning.appendChild(warningContent);
    
    actionsButtons.appendChild(saveButton);
    actionsButtons.appendChild(restoreButton);
    actionsButtons.appendChild(warning);
    
    actionsHeader.appendChild(actionsTitle);
    actionsHeader.appendChild(actionsDesc);
    actionsHeader.appendChild(actionsButtons);
    actionsCard.appendChild(actionsHeader);
    
    configGrid.appendChild(configCard);
    configGrid.appendChild(actionsCard);
    
    // Informações do Sistema
    const systemCard = createElement('div', { className: 'bg-white shadow overflow-hidden sm:rounded-lg' });
    const systemHeader = createElement('div', { className: 'px-4 py-5 sm:p-6' });
    const systemTitle = createElement('h3', { className: 'text-lg leading-6 font-medium text-gray-900 mb-4' }, 'Informações do Sistema Modular');
    const systemDesc = createElement('p', { className: 'text-sm text-gray-600 mb-6' }, 'Detalhes sobre a integração com o core');
    
    const systemGrid = createElement('div', { className: 'grid gap-4 md:grid-cols-3' });
    
    // Status cards
    const statusCards = [
      { icon: '✅', title: 'Module Registry', desc: 'Registrado no core', color: 'blue' },
      { icon: '✅', title: 'Ativação por Empresa', desc: 'Sistema funcionando', color: 'green' },
      { icon: '✅', title: 'Integração Completa', desc: 'Todas as áreas ativas', color: 'purple' }
    ];
    
    statusCards.forEach(card => {
      const statusCard = createElement('div', { className: 'text-center p-4 bg-gray-50 rounded-lg' });
      const statusIcon = createElement('div', { className: `text-2xl font-bold text-${card.color}-600 mb-2` }, card.icon);
      const statusTitle = createElement('div', { className: `text-sm font-medium text-gray-900 mb-1` }, card.title);
      const statusDesc = createElement('div', { className: 'text-xs text-gray-600' }, card.desc);
      
      statusCard.appendChild(statusIcon);
      statusCard.appendChild(statusTitle);
      statusCard.appendChild(statusDesc);
      systemGrid.appendChild(statusCard);
    });
    
    systemHeader.appendChild(systemTitle);
    systemHeader.appendChild(systemDesc);
    systemHeader.appendChild(systemGrid);
    systemCard.appendChild(systemHeader);
    
    // Informações Técnicas
    const infoBox = createElement('div', { className: 'mt-6 bg-green-50 border border-green-200 rounded-lg p-4' });
    const infoHeader = createElement('div', { className: 'flex' });
    
    const infoIcon = createElement('div', { className: 'flex-shrink-0' });
    const infoIconSpan = createElement('span', { className: 'h-5 w-5 text-green-400' }, '✅');
    infoIcon.appendChild(infoIconSpan);
    
    const infoContent = createElement('div', { className: 'ml-3' });
    const infoTitle = createElement('h3', { className: 'text-sm font-medium text-green-800' }, 'Carregamento Dinâmico Funcionando');
    const infoText = createElement('p', { className: 'mt-2 text-sm text-green-700' }, 
      'Esta página está sendo carregada dinamicamente pelo sistema de roteamento /modules/[...slug]. O módulo é completamente independente e pode ser distribuído como um arquivo ZIP.'
    );
    
    infoContent.appendChild(infoTitle);
    infoContent.appendChild(infoText);
    infoHeader.appendChild(infoIcon);
    infoHeader.appendChild(infoContent);
    infoBox.appendChild(infoHeader);
    
    // Montar tudo
    container.appendChild(header);
    container.appendChild(configGrid);
    container.appendChild(systemCard);
    container.appendChild(infoBox);
    
    return container;
  };

  return {
    render
  };
}

// Exportar para uso no sistema de roteamento
if (typeof window !== 'undefined') {
  window.ModuleExemploSettingsPage = ModuleExemploSettingsPage;
}