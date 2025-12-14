/**
 * PÁGINA PRINCIPAL DO MODULE EXEMPLO
 * 
 * Versão híbrida - usa ModuleCore para acessar funcionalidades do sistema
 * Mantém independência mas pode integrar com o core quando disponível
 */

function ModuleExemploPage() {
  // Inicializar o ModuleCore se disponível
  let core = null;
  let bridge = null;
  
  console.log('🔍 Verificando disponibilidade do sistema...');
  console.log('window.ModuleCore:', typeof window !== 'undefined' ? !!window.ModuleCore : 'window não disponível');
  console.log('ModuleBridge:', typeof ModuleBridge !== 'undefined' ? 'disponível' : 'não disponível');
  
  if (typeof window !== 'undefined' && window.ModuleCore) {
    core = window.ModuleCore;
    console.log('✅ ModuleCore encontrado');
    
    // Tentar inicializar com o bridge do sistema
    if (typeof ModuleBridge !== 'undefined') {
      core.init(ModuleBridge);
      bridge = core.getBridge();
      console.log('🔧 Módulo inicializado com bridge do sistema');
    } else {
      bridge = core.getBridge(); // Usará fallback
      console.log('🔧 Módulo inicializado com bridge de fallback');
    }
  } else {
    console.log('⚠️ ModuleCore não encontrado, usando modo básico');
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
    
    const iconDiv = createElement('div', { className: 'p-2 bg-blue-100 rounded-lg' });
    const icon = createElement('div', { 
      className: 'h-6 w-6 text-blue-600',
      innerHTML: '📦'
    });
    iconDiv.appendChild(icon);
    
    const textDiv = createElement('div');
    const title = createElement('h1', { className: 'text-2xl font-bold text-gray-900' }, 'Module Exemplo');
    const subtitle = createElement('p', { className: 'text-gray-600' }, 'Demonstração do sistema modular independente');
    textDiv.appendChild(title);
    textDiv.appendChild(subtitle);
    
    headerContent.appendChild(iconDiv);
    headerContent.appendChild(textDiv);
    
    const badges = createElement('div', { className: 'flex items-center gap-2' });
    const activeBadge = createElement('span', { 
      className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800'
    }, 'Ativo');
    const versionBadge = createElement('span', { 
      className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800'
    }, 'v1.0.0');
    badges.appendChild(activeBadge);
    badges.appendChild(versionBadge);
    
    header.appendChild(headerContent);
    header.appendChild(badges);
    
    // Cards informativos
    const cardsGrid = createElement('div', { className: 'grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6' });
    
    // Card 1 - Status
    const card1 = createElement('div', { className: 'bg-white overflow-hidden shadow rounded-lg' });
    const card1Content = createElement('div', { className: 'p-5' });
    const card1Header = createElement('div', { className: 'flex items-center' });
    
    const card1Icon = createElement('div', { className: 'flex-shrink-0' });
    const card1IconSpan = createElement('span', { className: 'h-6 w-6 text-green-600' }, '✅');
    card1Icon.appendChild(card1IconSpan);
    
    const card1Text = createElement('div', { className: 'ml-5 w-0 flex-1' });
    const card1Title = createElement('dt', { className: 'text-sm font-medium text-gray-500 truncate' }, 'Status do Módulo');
    const card1Value = createElement('dd', { className: 'text-lg font-medium text-green-600' }, 'Funcionando');
    card1Text.appendChild(card1Title);
    card1Text.appendChild(card1Value);
    
    card1Header.appendChild(card1Icon);
    card1Header.appendChild(card1Text);
    card1Content.appendChild(card1Header);
    
    const card1Footer = createElement('div', { className: 'bg-gray-50 px-5 py-3' });
    const card1FooterText = createElement('span', { className: 'text-gray-600' }, 'Módulo carregado com sucesso');
    card1Footer.appendChild(card1FooterText);
    
    card1.appendChild(card1Content);
    card1.appendChild(card1Footer);
    cardsGrid.appendChild(card1);
    
    // Card 2 - Integração
    const card2 = createElement('div', { className: 'bg-white overflow-hidden shadow rounded-lg' });
    const card2Content = createElement('div', { className: 'p-5' });
    const card2Header = createElement('div', { className: 'flex items-center' });
    
    const card2Icon = createElement('div', { className: 'flex-shrink-0' });
    const card2IconSpan = createElement('span', { className: 'h-6 w-6 text-blue-600' }, '🔧');
    card2Icon.appendChild(card2IconSpan);
    
    const card2Text = createElement('div', { className: 'ml-5 w-0 flex-1' });
    const card2Title = createElement('dt', { className: 'text-sm font-medium text-gray-500 truncate' }, 'Integração');
    const card2Value = createElement('dd', { className: 'text-lg font-medium text-blue-600' }, 'Independente');
    card2Text.appendChild(card2Title);
    card2Text.appendChild(card2Value);
    
    card2Header.appendChild(card2Icon);
    card2Header.appendChild(card2Text);
    card2Content.appendChild(card2Header);
    
    const card2Footer = createElement('div', { className: 'bg-gray-50 px-5 py-3' });
    const card2FooterText = createElement('span', { className: 'text-gray-600' }, 'Módulo completamente independente');
    card2Footer.appendChild(card2FooterText);
    
    card2.appendChild(card2Content);
    card2.appendChild(card2Footer);
    cardsGrid.appendChild(card2);
    
    // Card 3 - Acesso
    const card3 = createElement('div', { className: 'bg-white overflow-hidden shadow rounded-lg' });
    const card3Content = createElement('div', { className: 'p-5' });
    const card3Header = createElement('div', { className: 'flex items-center' });
    
    const card3Icon = createElement('div', { className: 'flex-shrink-0' });
    const card3IconSpan = createElement('span', { className: 'h-6 w-6 text-purple-600' }, '👤');
    card3Icon.appendChild(card3IconSpan);
    
    const card3Text = createElement('div', { className: 'ml-5 w-0 flex-1' });
    const card3Title = createElement('dt', { className: 'text-sm font-medium text-gray-500 truncate' }, 'Acesso');
    const card3Value = createElement('dd', { className: 'text-lg font-medium text-purple-600' }, 'Autorizado');
    card3Text.appendChild(card3Title);
    card3Text.appendChild(card3Value);
    
    card3Header.appendChild(card3Icon);
    card3Header.appendChild(card3Text);
    card3Content.appendChild(card3Header);
    
    const card3Footer = createElement('div', { className: 'bg-gray-50 px-5 py-3' });
    const card3FooterText = createElement('span', { className: 'text-gray-600' }, 'Usuário tem permissão de acesso');
    card3Footer.appendChild(card3FooterText);
    
    card3.appendChild(card3Content);
    card3.appendChild(card3Footer);
    cardsGrid.appendChild(card3);
    
    // Gerador de Notificações (usando bridge se disponível)
    const notificationCard = bridge ? bridge.createCard(
      '🔔 Gerador de Notificações Inteligente',
      ''
    ) : createElement('div', { className: 'bg-white shadow overflow-hidden sm:rounded-lg mb-6' });
    
    // Criar conteúdo do formulário
    const notificationForm = createElement('div', { className: 'space-y-4' });
    
    const description = createElement('p', { 
      className: 'text-sm text-gray-600 mb-6' 
    }, bridge && core.isReady() ? 
      'Sistema integrado - notificações serão enviadas via bridge do sistema' : 
      'Modo independente - simulação de notificações'
    );
    
    // Campo Título
    const titleField = createElement('div');
    const titleLabel = createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Título da Notificação');
    const titleInput = createElement('input', { 
      type: 'text',
      className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500',
      placeholder: 'Digite o título...',
      id: 'notification-title'
    });
    titleField.appendChild(titleLabel);
    titleField.appendChild(titleInput);
    
    // Campo Mensagem
    const messageField = createElement('div');
    const messageLabel = createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Mensagem');
    const messageInput = createElement('textarea', { 
      className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none',
      placeholder: 'Digite a mensagem...',
      rows: '3',
      id: 'notification-message'
    });
    messageField.appendChild(messageLabel);
    messageField.appendChild(messageInput);
    
    // Campo Tipo (novo)
    const typeField = createElement('div');
    const typeLabel = createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Tipo de Notificação');
    const typeSelect = createElement('select', { 
      className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500',
      id: 'notification-type'
    });
    
    const types = [
      { value: 'info', label: 'ℹ️ Informação' },
      { value: 'success', label: '✅ Sucesso' },
      { value: 'warning', label: '⚠️ Aviso' },
      { value: 'error', label: '❌ Erro' }
    ];
    
    types.forEach(type => {
      const option = createElement('option', { value: type.value }, type.label);
      typeSelect.appendChild(option);
    });
    
    typeField.appendChild(typeLabel);
    typeField.appendChild(typeSelect);
    
    // Botões de ação (usando bridge se disponível)
    const actionButtons = createElement('div', { className: 'flex gap-2' });
    
    // Botão enviar (usa bridge se disponível)
    const sendButton = bridge ? bridge.createButton('📤 Enviar Notificação', () => {
      const titleEl = document.getElementById('notification-title');
      const messageEl = document.getElementById('notification-message');
      const typeEl = document.getElementById('notification-type');
      
      if (!titleEl || !messageEl || !typeEl) {
        bridge.showNotification('Erro', 'Elementos do formulário não encontrados', 'error');
        return;
      }
      
      const title = titleEl.value;
      const message = messageEl.value;
      const type = typeEl.value;
      
      if (!title || !message) {
        bridge.showNotification('Aviso', 'Preencha título e mensagem', 'warning');
        return;
      }
      
      // Usar bridge para enviar notificação
      bridge.showNotification(title, message, type);
      
      // Limpar campos
      titleEl.value = '';
      messageEl.value = '';
      typeEl.selectedIndex = 0;
      
    }, 'primary') : createElement('button', { 
      className: 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors',
      onclick: () => {
        const titleEl = document.getElementById('notification-title');
        const messageEl = document.getElementById('notification-message');
        
        if (!titleEl || !messageEl) {
          alert('⚠️ Erro: Elementos não encontrados');
          return;
        }
        
        const title = titleEl.value;
        const message = messageEl.value;
        
        if (!title || !message) {
          alert('⚠️ Preencha título e mensagem');
          return;
        }
        
        alert('✅ Notificação Enviada!\n\nTítulo: ' + title + '\nMensagem: ' + message);
        
        titleEl.value = '';
        messageEl.value = '';
      }
    }, '📤 Enviar');
    
    // Botão de exemplos
    const exampleButton = bridge ? bridge.createButton('✨ Gerar Exemplos', () => {
      const examples = [
        { title: 'Tarefa Concluída', message: 'O relatório mensal foi processado com sucesso.', type: 'success' },
        { title: 'Aviso de Sistema', message: 'Manutenção programada para hoje às 22h.', type: 'warning' },
        { title: 'Exportação Finalizada', message: 'Arquivo de clientes exportado com 1.234 registros.', type: 'info' }
      ];
      
      // Enviar exemplos usando bridge
      examples.forEach((ex, i) => {
        setTimeout(() => {
          bridge.showNotification(ex.title, ex.message, ex.type);
        }, i * 1000); // Delay entre notificações
      });
      
    }, 'success') : createElement('button', { 
      className: 'px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors',
      onclick: () => {
        alert('✨ Exemplos gerados!\n\n(Em modo independente)');
      }
    }, '✨ Exemplos');
    
    actionButtons.appendChild(sendButton);
    actionButtons.appendChild(exampleButton);
    
    notificationForm.appendChild(description);
    notificationForm.appendChild(titleField);
    notificationForm.appendChild(messageField);
    notificationForm.appendChild(typeField);
    notificationForm.appendChild(actionButtons);
    
    // Adicionar formulário ao card
    if (bridge) {
      // Se usando bridge, adicionar ao card criado pelo bridge
      const cardContent = notificationCard.querySelector('.px-4');
      if (cardContent) {
        cardContent.appendChild(notificationForm);
      }
    } else {
      // Modo independente
      const notificationHeader = createElement('div', { className: 'px-4 py-5 sm:p-6' });
      const notificationTitle = createElement('h3', { 
        className: 'text-lg leading-6 font-medium text-gray-900 mb-4 flex items-center gap-2' 
      });
      const bellIcon = createElement('span', { className: 'h-5 w-5' }, '🔔');
      const titleText = createElement('span', {}, 'Gerador de Notificações');
      notificationTitle.appendChild(bellIcon);
      notificationTitle.appendChild(titleText);
      
      notificationHeader.appendChild(notificationTitle);
      notificationHeader.appendChild(notificationForm);
      notificationCard.appendChild(notificationHeader);
    }
    
    // Seção de Dados do Usuário (usando bridge)
    const userCard = bridge ? bridge.createCard('👤 Dados do Usuário Atual', '') : 
      createElement('div', { className: 'bg-white shadow overflow-hidden sm:rounded-lg mb-6' });
    
    const userContent = createElement('div', { className: 'space-y-4' });
    
    // Botão para carregar dados do usuário
    const loadUserButton = bridge ? bridge.createButton('🔄 Carregar Dados do Usuário', async () => {
      try {
        // Mostrar loading
        const loadingEl = core.components.createLoader('Carregando dados do usuário...');
        userContent.innerHTML = '';
        userContent.appendChild(loadingEl);
        
        // Carregar dados via bridge
        const user = await bridge.getCurrentUser();
        
        // Limpar loading
        userContent.innerHTML = '';
        
        // Mostrar dados do usuário
        const userInfo = createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' });
        
        const userData = [
          { label: 'ID', value: user.id },
          { label: 'Nome', value: user.name },
          { label: 'Email', value: user.email },
          { label: 'Função', value: user.role },
          { label: 'Tenant', value: user.tenant },
          { label: 'Permissões', value: user.permissions.join(', ') }
        ];
        
        userData.forEach(item => {
          const field = createElement('div', { className: 'p-3 bg-gray-50 rounded-lg' });
          const label = createElement('div', { className: 'text-sm font-medium text-gray-700' }, item.label);
          const value = createElement('div', { className: 'text-sm text-gray-900 mt-1' }, item.value);
          field.appendChild(label);
          field.appendChild(value);
          userInfo.appendChild(field);
        });
        
        userContent.appendChild(userInfo);
        
        // Adicionar timestamp
        const timestamp = createElement('div', { className: 'text-xs text-gray-500 mt-4' }, 
          `Carregado em: ${bridge.formatDate(new Date())}`
        );
        userContent.appendChild(timestamp);
        
        bridge.showNotification('Sucesso', 'Dados do usuário carregados com sucesso!', 'success');
        
      } catch (error) {
        userContent.innerHTML = '';
        const errorEl = bridge.createAlert('Erro ao carregar dados do usuário: ' + error.message, 'error');
        userContent.appendChild(errorEl);
      }
    }, 'primary') : createElement('button', { 
      className: 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors',
      onclick: () => alert('Funcionalidade disponível apenas com bridge do sistema')
    }, '🔄 Carregar Dados');
    
    userContent.appendChild(loadUserButton);
    
    // Adicionar ao card
    if (bridge) {
      const cardContent = userCard.querySelector('.px-4');
      if (cardContent) {
        cardContent.appendChild(userContent);
      }
    } else {
      const userHeader = createElement('div', { className: 'px-4 py-5 sm:p-6' });
      const userTitle = createElement('h3', { className: 'text-lg leading-6 font-medium text-gray-900 mb-4' }, '👤 Dados do Usuário');
      userHeader.appendChild(userTitle);
      userHeader.appendChild(userContent);
      userCard.appendChild(userHeader);
    }
    
    // Informações Técnicas
    const statusMessage = bridge && core.isReady() ? 
      'Sistema Híbrido Ativo - Módulo integrado com bridge do sistema principal' :
      'Modo Independente - Módulo funcionando sem dependências externas';
      
    const statusType = bridge && core.isReady() ? 'success' : 'info';
    
    const infoBox = bridge ? bridge.createAlert(statusMessage, statusType) : 
      createElement('div', { className: 'mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4' });
    
    if (!bridge) {
      const infoHeader = createElement('div', { className: 'flex' });
      
      const infoIcon = createElement('div', { className: 'flex-shrink-0' });
      const infoIconSpan = createElement('span', { className: 'h-5 w-5 text-blue-400' }, 'ℹ️');
      infoIcon.appendChild(infoIconSpan);
      
      const infoContent = createElement('div', { className: 'ml-3' });
      const infoTitle = createElement('h3', { className: 'text-sm font-medium text-blue-800' }, 'Módulo Independente');
      const infoText = createElement('p', { className: 'mt-2 text-sm text-blue-700' }, statusMessage);
      
      infoContent.appendChild(infoTitle);
      infoContent.appendChild(infoText);
      infoHeader.appendChild(infoIcon);
      infoHeader.appendChild(infoContent);
      infoBox.appendChild(infoHeader);
    }
    
    // Montar tudo
    container.appendChild(header);
    container.appendChild(cardsGrid);
    container.appendChild(notificationCard);
    container.appendChild(userCard);
    container.appendChild(infoBox);
    
    return container;
  };

  return {
    render
  };
}

// Exportar para uso no sistema de roteamento
if (typeof window !== 'undefined') {
  window.ModuleExemploPage = ModuleExemploPage;
}