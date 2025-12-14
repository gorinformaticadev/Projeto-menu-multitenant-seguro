/**
 * WIDGET DO MODULE EXEMPLO PARA DASHBOARD
 * 
 * Versão standalone sem dependências externas
 * JavaScript puro, sem dependências externas
 */

function ExemploWidget() {
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

  // Renderizar o widget
  const render = () => {
    const container = createElement('div', { 
      className: 'w-full bg-white border border-green-200 bg-green-50/50 rounded-lg shadow' 
    });
    
    // Header do widget
    const header = createElement('div', { 
      className: 'flex flex-row items-center justify-between space-y-0 pb-2 p-4' 
    });
    
    const title = createElement('h3', { 
      className: 'text-sm font-medium flex items-center gap-2 text-green-900' 
    });
    
    const icon = createElement('span', { className: 'h-4 w-4' }, '📦');
    const titleText = createElement('span', {}, 'Module Exemplo');
    title.appendChild(icon);
    title.appendChild(titleText);
    
    const badge = createElement('span', { 
      className: 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800' 
    });
    const checkIcon = createElement('span', { className: 'h-3 w-3 mr-1' }, '✅');
    const badgeText = createElement('span', {}, 'Ativo');
    badge.appendChild(checkIcon);
    badge.appendChild(badgeText);
    
    header.appendChild(title);
    header.appendChild(badge);
    
    // Conteúdo do widget
    const content = createElement('div', { className: 'p-4 pt-0' });
    
    const status = createElement('div', { 
      className: 'text-2xl font-bold text-green-600 mb-2' 
    }, 'Funcionando');
    
    const description = createElement('p', { 
      className: 'text-xs text-green-700 mb-3' 
    }, 'Widget independente com funcionalidades interativas.');
    
    // Métricas do widget
    const metricsRow = createElement('div', { className: 'grid grid-cols-2 gap-2 mb-3 text-xs' });
    
    const loadTime = createElement('div', { className: 'text-center p-2 bg-green-100 rounded' });
    const loadTimeLabel = createElement('div', { className: 'font-medium text-green-800' }, 'Carregamento');
    const loadTimeValue = createElement('div', { className: 'text-green-600' }, '0.2s');
    loadTime.appendChild(loadTimeLabel);
    loadTime.appendChild(loadTimeValue);
    
    const memoryUsage = createElement('div', { className: 'text-center p-2 bg-blue-100 rounded' });
    const memoryLabel = createElement('div', { className: 'font-medium text-blue-800' }, 'Memória');
    const memoryValue = createElement('div', { className: 'text-blue-600' }, '1.8MB');
    memoryUsage.appendChild(memoryLabel);
    memoryUsage.appendChild(memoryValue);
    
    metricsRow.appendChild(loadTime);
    metricsRow.appendChild(memoryUsage);
    
    // Botão de ação
    const actionButton = createElement('button', { 
      className: 'w-full px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors',
      onclick: () => {
        const stats = {
          clicks: Math.floor(Math.random() * 100) + 1,
          uptime: '99.9%',
          lastUpdate: new Date().toLocaleTimeString(),
          status: 'Operacional'
        };
        
        alert('📊 Estatísticas do Widget:\n\n' + Object.entries(stats).map(([key, value]) => `${key}: ${value}`).join('\n') + '\n\n✨ Widget funcionando perfeitamente!');
      }
    }, '📊 Ver Estatísticas');
    
    const statusRow = createElement('div', { 
      className: 'flex items-center justify-between text-xs mt-2' 
    });
    const statusLabel = createElement('span', { className: 'text-green-600' }, 'Tipo:');
    const statusValue = createElement('span', { className: 'font-medium text-green-700' }, 'Independente');
    statusRow.appendChild(statusLabel);
    statusRow.appendChild(statusValue);
    
    content.appendChild(status);
    content.appendChild(description);
    content.appendChild(metricsRow);
    content.appendChild(actionButton);
    content.appendChild(statusRow);
    
    // Montar widget
    container.appendChild(header);
    container.appendChild(content);
    
    return container;
  };

  return {
    render
  };
}

// Exportar para uso no sistema
if (typeof window !== 'undefined') {
  window.ExemploWidget = ExemploWidget;
}