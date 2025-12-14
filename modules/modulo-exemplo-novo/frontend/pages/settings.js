/**
 * PÁGINA DE CONFIGURAÇÕES DO MODULE TEMPLATE
 * 
 * Módulo para páginas de configurações de módulos
 * JavaScript puro, sem dependências externas
 */

function ModuleMóduloSettingsPage() {
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
    
    const iconDiv = createElement('div', { className: 'p-2 bg-purple-100 rounded-lg' });
    const icon = createElement('div', { 
      className: 'h-6 w-6 text-purple-600',
      innerHTML: '⚙️'
    });
    iconDiv.appendChild(icon);
    
    const textDiv = createElement('div');
    const title = createElement('h1', { className: 'text-2xl font-bold text-gray-900' }, 'Configurações do Módulo');
    const subtitle = createElement('p', { className: 'text-gray-600' }, 'Módulo para páginas de configurações');
    textDiv.appendChild(title);
    textDiv.appendChild(subtitle);
    
    headerContent.appendChild(iconDiv);
    headerContent.appendChild(textDiv);
    
    const badges = createElement('div', { className: 'flex items-center gap-2' });
    const mduloexemplonovoBadge = createElement('span', { 
      className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800'
    }, 'Módulo de Configurações');
    badges.appendChild(mduloexemplonovoBadge);
    
    header.appendChild(headerContent);
    header.appendChild(badges);
    
    // Configurações do Módulo
    const configGrid = createElement('div', { className: 'grid gap-6 md:grid-cols-2 mb-6' });
    
    // Card de Configurações Básicas
    const basicCard = createElement('div', { className: 'bg-white shadow overflow-hidden sm:rounded-lg' });
    const basicHeader = createElement('div', { className: 'px-4 py-5 sm:p-6' });
    const basicTitle = createElement('h3', { className: 'text-lg leading-6 font-medium text-gray-900 mb-4 flex items-center gap-2' });
    
    const basicIcon = createElement('span', { className: 'h-5 w-5 text-purple-500' }, '🔧');
    const basicTitleText = createElement('span', {}, 'Configurações Básicas');
    basicTitle.appendChild(basicIcon);
    basicTitle.appendChild(basicTitleText);
    
    const basicDesc = createElement('p', { className: 'text-sm text-gray-600 mb-6' }, 'Configurações essenciais do módulo');
    
    const basicForm = createElement('div', { className: 'space-y-4' });
    
    // Campo Nome do Módulo
    const nameField = createElement('div');
    const nameLabel = createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Nome do Módulo');
    const nameInput = createElement('input', { 
      type: 'text',
      className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500',
      value: 'Módulo Exemplo Novo',
      id: 'module-name'
    });
    nameField.appendChild(nameLabel);
    nameField.appendChild(nameInput);
    
    // Campo Versão
    const versionField = createElement('div');
    const versionLabel = createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Versão');
    const versionInput = createElement('input', { 
      type: 'text',
      className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500',
      value: '1.0.0',
      id: 'module-version'
    });
    versionField.appendChild(versionLabel);
    versionField.appendChild(versionInput);
    
    // Campo Status
    const statusField = createElement('div');
    const statusLabel = createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Status');
    const statusSelect = createElement('select', { 
      className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500',
      id: 'module-status'
    });
    
    const statusOptions = [
      { value: 'enabled', label: 'Habilitado' },
      { value: 'disabled', label: 'Desabilitado' },
      { value: 'maintenance', label: 'Manutenção' }
    ];
    
    statusOptions.forEach(option => {
      const optionEl = createElement('option', { value: option.value }, option.label);
      if (option.value === 'disabled') optionEl.selected = true;
      statusSelect.appendChild(optionEl);
    });
    
    statusField.appendChild(statusLabel);
    statusField.appendChild(statusSelect);
    
    basicForm.appendChild(nameField);
    basicForm.appendChild(versionField);
    basicForm.appendChild(statusField);
    
    basicHeader.appendChild(basicTitle);
    basicHeader.appendChild(basicDesc);
    basicHeader.appendChild(basicForm);
    basicCard.appendChild(basicHeader);
    
    // Card de Configurações Avançadas
    const advancedCard = createElement('div', { className: 'bg-white shadow overflow-hidden sm:rounded-lg' });
    const advancedHeader = createElement('div', { className: 'px-4 py-5 sm:p-6' });
    const advancedTitle = createElement('h3', { className: 'text-lg leading-6 font-medium text-gray-900 mb-4' }, '🔒 Configurações de Segurança');
    const advancedDesc = createElement('p', { className: 'text-sm text-gray-600 mb-6' }, 'Configurações de segurança e isolamento');
    
    const advancedForm = createElement('div', { className: 'space-y-4' });
    
    // Checkbox Sandbox
    const sandboxField = createElement('label', { className: 'flex items-center cursor-pointer' });
    const sandboxCheckbox = createElement('input', { type: 'checkbox', className: 'mr-2', checked: true, disabled: true });
    const sandboxText = createElement('span', { className: 'text-sm' }, 'Executar em Sandbox (Obrigatório)');
    sandboxField.appendChild(sandboxCheckbox);
    sandboxField.appendChild(sandboxText);
    
    // Checkbox Permissões Estritas
    const permissionsField = createElement('label', { className: 'flex items-center cursor-pointer' });
    const permissionsCheckbox = createElement('input', { type: 'checkbox', className: 'mr-2', checked: true, disabled: true });
    const permissionsText = createElement('span', { className: 'text-sm' }, 'Permissões Estritas (Obrigatório)');
    permissionsField.appendChild(permissionsCheckbox);
    permissionsField.appendChild(permissionsText);
    
    // Checkbox Autenticação
    const authField = createElement('label', { className: 'flex items-center cursor-pointer' });
    const authCheckbox = createElement('input', { type: 'checkbox', className: 'mr-2', checked: true, id: 'require-auth' });
    const authText = createElement('span', { className: 'text-sm' }, 'Requer Autenticação');
    authField.appendChild(authCheckbox);
    authField.appendChild(authText);
    
    advancedForm.appendChild(sandboxField);
    advancedForm.appendChild(permissionsField);
    advancedForm.appendChild(authField);
    
    advancedHeader.appendChild(advancedTitle);
    advancedHeader.appendChild(advancedDesc);
    advancedHeader.appendChild(advancedForm);
    advancedCard.appendChild(advancedHeader);
    
    configGrid.appendChild(basicCard);
    configGrid.appendChild(advancedCard);
    
    // Ações
    const actionsCard = createElement('div', { className: 'bg-white shadow overflow-hidden sm:rounded-lg mb-6' });
    const actionsHeader = createElement('div', { className: 'px-4 py-5 sm:p-6' });
    const actionsTitle = createElement('h3', { className: 'text-lg leading-6 font-medium text-gray-900 mb-4' }, '💾 Ações');
    const actionsDesc = createElement('p', { className: 'text-sm text-gray-600 mb-6' }, 'Salvar ou restaurar configurações');
    
    const actionsButtons = createElement('div', { className: 'flex gap-3' });
    
    // Botão Salvar
    const saveButton = createElement('button', { 
      className: 'px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors',
      onclick: () => {
        const config = {
          name: document.getElementById('module-name')?.value || '',
          version: document.getElementById('module-version')?.value || '',
          status: document.getElementById('module-status')?.value || '',
          requireAuth: document.getElementById('require-auth')?.checked || false
        };
        
        alert('💾 Configurações Salvas (Módulo):\n\n' + JSON.stringify(config, null, 2) + '\n\n✅ Em um módulo real, essas configurações seriam salvas no backend.');
      }
    });
    const saveIcon = createElement('span', { className: 'mr-2' }, '💾');
    const saveText = createElement('span', {}, 'Salvar Configurações');
    saveButton.appendChild(saveIcon);
    saveButton.appendChild(saveText);
    
    // Botão Restaurar
    const restoreButton = createElement('button', { 
      className: 'px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50',
      onclick: () => {
        // Restaurar valores padrão
        const nameInput = document.getElementById('module-name');
        const versionInput = document.getElementById('module-version');
        const statusSelect = document.getElementById('module-status');
        const authCheckbox = document.getElementById('require-auth');
        
        if (nameInput) nameInput.value = 'Módulo Exemplo Novo';
        if (versionInput) versionInput.value = '1.0.0';
        if (statusSelect) statusSelect.value = 'disabled';
        if (authCheckbox) authCheckbox.checked = true;
        
        alert('🔄 Configurações restauradas para os valores padrão');
      }
    });
    const restoreIcon = createElement('span', { className: 'mr-2' }, '🔄');
    const restoreText = createElement('span', {}, 'Restaurar Padrões');
    restoreButton.appendChild(restoreIcon);
    restoreButton.appendChild(restoreText);
    
    actionsButtons.appendChild(saveButton);
    actionsButtons.appendChild(restoreButton);
    
    actionsHeader.appendChild(actionsTitle);
    actionsHeader.appendChild(actionsDesc);
    actionsHeader.appendChild(actionsButtons);
    actionsCard.appendChild(actionsHeader);
    
    // Informações do Módulo
    const mduloexemplonovoCard = createElement('div', { className: 'bg-white shadow overflow-hidden sm:rounded-lg' });
    const mduloexemplonovoHeader = createElement('div', { className: 'px-4 py-5 sm:p-6' });
    const mduloexemplonovoTitle = createElement('h3', { className: 'text-lg leading-6 font-medium text-gray-900 mb-4' }, '📋 Sobre este Módulo');
    const mduloexemplonovoDesc = createElement('p', { className: 'text-sm text-gray-600 mb-6' }, 'Informações sobre como usar este mduloexemplonovo');
    
    const mduloexemplonovoInfo = createElement('div', { className: 'space-y-3' });
    
    const mduloexemplonovoPoints = [
      'Este é um mduloexemplonovo para páginas de configurações',
      'Copie e modifique conforme suas necessidades',
      'Mantenha sempre as validações de segurança',
      'Use o ModuleCore para integração com o sistema',
      'Implemente persistência real no backend'
    ];
    
    mduloexemplonovoPoints.forEach(point => {
      const pointEl = createElement('div', { className: 'flex items-start gap-2' });
      const pointIcon = createElement('span', { className: 'text-purple-600 mt-0.5' }, '•');
      const pointText = createElement('span', { className: 'text-sm text-gray-700' }, point);
      
      pointEl.appendChild(pointIcon);
      pointEl.appendChild(pointText);
      mduloexemplonovoInfo.appendChild(pointEl);
    });
    
    mduloexemplonovoHeader.appendChild(mduloexemplonovoTitle);
    mduloexemplonovoHeader.appendChild(mduloexemplonovoDesc);
    mduloexemplonovoHeader.appendChild(mduloexemplonovoInfo);
    mduloexemplonovoCard.appendChild(mduloexemplonovoHeader);
    
    // Informações Técnicas
    const infoBox = createElement('div', { className: 'mt-6 bg-purple-50 border border-purple-200 rounded-lg p-4' });
    const infoHeader = createElement('div', { className: 'flex' });
    
    const infoIcon = createElement('div', { className: 'flex-shrink-0' });
    const infoIconSpan = createElement('span', { className: 'h-5 w-5 text-purple-400' }, '📄');
    infoIcon.appendChild(infoIconSpan);
    
    const infoContent = createElement('div', { className: 'ml-3' });
    const infoTitle = createElement('h3', { className: 'text-sm font-medium text-purple-800' }, 'Módulo de Configurações');
    const infoText = createElement('p', { className: 'mt-2 text-sm text-purple-700' }, 
      'Esta página demonstra como implementar configurações em módulos independentes. Modifique conforme suas necessidades específicas.'
    );
    
    infoContent.appendChild(infoTitle);
    infoContent.appendChild(infoText);
    infoHeader.appendChild(infoIcon);
    infoHeader.appendChild(infoContent);
    infoBox.appendChild(infoHeader);
    
    // Montar tudo
    container.appendChild(header);
    container.appendChild(configGrid);
    container.appendChild(actionsCard);
    container.appendChild(mduloexemplonovoCard);
    container.appendChild(infoBox);
    
    return container;
  };

  return {
    render
  };
}

// Exportar para uso no sistema de roteamento
if (typeof window !== 'undefined') {
  window.ModuleMóduloSettingsPage = ModuleMóduloSettingsPage;
}