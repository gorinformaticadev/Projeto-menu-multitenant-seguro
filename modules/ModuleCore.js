/**
 * MODULE CORE - COMPONENTE GLOBAL PARA TODOS OS MÓDULOS
 * 
 * Fornece funcionalidades comuns e acesso às dependências do sistema
 * através do ModuleBridge
 */

class ModuleCore {
  constructor() {
    this.bridge = null;
    this.initialized = false;
  }

  // Inicializar o core com o bridge do sistema
  init(bridge) {
    this.bridge = bridge;
    this.initialized = true;
    console.log('🔧 ModuleCore inicializado com bridge');
  }

  // Verificar se está inicializado
  isReady() {
    return this.initialized && this.bridge !== null;
  }

  // Obter o bridge (com fallback para funcionalidades básicas)
  getBridge() {
    if (this.bridge) {
      return this.bridge;
    }
    
    // Fallback para funcionalidades básicas sem bridge
    return this.createFallbackBridge();
  }

  // Bridge de fallback para quando o sistema principal não está disponível
  createFallbackBridge() {
    return {
      // Função básica para criar elementos
      createElement: (tag, props = {}, ...children) => {
        const element = document.createElement(tag);
        
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
        
        children.forEach(child => {
          if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
          } else if (child instanceof HTMLElement) {
            element.appendChild(child);
          }
        });
        
        return element;
      },

      // Botão básico
      createButton: (text, onClick, variant = 'primary') => {
        const classes = {
          primary: 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors',
          secondary: 'px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors',
          success: 'px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors',
          danger: 'px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors'
        };
        
        return this.createElement('button', {
          className: classes[variant],
          onclick: onClick
        }, text);
      },

      // Card básico
      createCard: (title, content) => {
        const card = this.createElement('div', { className: 'bg-white overflow-hidden shadow rounded-lg' });
        const header = this.createElement('div', { className: 'px-4 py-5 sm:p-6' });
        const titleEl = this.createElement('h3', { className: 'text-lg leading-6 font-medium text-gray-900 mb-4' }, title);
        
        header.appendChild(titleEl);
        
        if (typeof content === 'string') {
          const contentEl = this.createElement('div', { className: 'text-sm text-gray-600' }, content);
          header.appendChild(contentEl);
        } else {
          header.appendChild(content);
        }
        
        card.appendChild(header);
        return card;
      },

      // Alert básico
      createAlert: (message, type = 'info') => {
        const typeClasses = {
          info: 'bg-blue-50 border border-blue-200 rounded-lg p-4',
          success: 'bg-green-50 border border-green-200 rounded-lg p-4',
          warning: 'bg-yellow-50 border border-yellow-200 rounded-lg p-4',
          error: 'bg-red-50 border border-red-200 rounded-lg p-4'
        };
        
        const iconMap = {
          info: 'ℹ️',
          success: '✅',
          warning: '⚠️',
          error: '❌'
        };
        
        const alert = this.createElement('div', { className: typeClasses[type] });
        const content = this.createElement('div', { className: 'flex' });
        
        const icon = this.createElement('div', { className: 'flex-shrink-0' });
        const iconSpan = this.createElement('span', { className: 'h-5 w-5' }, iconMap[type]);
        icon.appendChild(iconSpan);
        
        const messageEl = this.createElement('div', { className: 'ml-3' });
        const messageText = this.createElement('p', { className: 'text-sm' }, message);
        messageEl.appendChild(messageText);
        
        content.appendChild(icon);
        content.appendChild(messageEl);
        alert.appendChild(content);
        
        return alert;
      },

      // Notificação básica
      showNotification: (title, message, type = 'info') => {
        const typeEmoji = {
          info: 'ℹ️',
          success: '✅',
          warning: '⚠️',
          error: '❌'
        };
        
        alert(`${typeEmoji[type]} ${title}\n\n${message}\n\n(Modo independente - sem integração com sistema)`);
      },

      // Navegação básica
      navigate: (path) => {
        if (typeof window !== 'undefined') {
          window.location.href = path;
        }
      },

      // Usuário mock
      getCurrentUser: async () => {
        return {
          id: 1,
          name: 'Usuário Mock',
          email: 'mock@exemplo.com',
          role: 'user',
          tenant: 'mock-tenant',
          permissions: ['read']
        };
      },

      // Formatação básica
      formatDate: (date) => {
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleDateString('pt-BR');
      },

      formatCurrency: (value) => {
        return `R$ ${value.toFixed(2).replace('.', ',')}`;
      },

      // Classes básicas
      getSystemClasses: () => ({
        button: {
          primary: 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors',
          secondary: 'px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors',
          success: 'px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors',
          danger: 'px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors'
        },
        card: 'bg-white overflow-hidden shadow rounded-lg',
        alert: {
          info: 'bg-blue-50 border border-blue-200 rounded-lg p-4',
          success: 'bg-green-50 border border-green-200 rounded-lg p-4',
          warning: 'bg-yellow-50 border border-yellow-200 rounded-lg p-4',
          error: 'bg-red-50 border border-red-200 rounded-lg p-4'
        }
      })
    };
  }

  // Utilitários comuns para módulos
  utils = {
    // Gerar ID único
    generateId: () => {
      return 'module_' + Math.random().toString(36).substr(2, 9);
    },

    // Debounce para eventos
    debounce: (func, wait) => {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    // Validação de email
    isValidEmail: (email) => {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return re.test(email);
    },

    // Formatação de texto
    capitalize: (str) => {
      return str.charAt(0).toUpperCase() + str.slice(1);
    },

    // Truncar texto
    truncate: (str, length = 100) => {
      return str.length > length ? str.substring(0, length) + '...' : str;
    }
  };

  // Criar componentes comuns
  components = {
    // Loading spinner
    createLoader: (message = 'Carregando...') => {
      const bridge = this.getBridge();
      const container = bridge.createElement('div', { 
        className: 'flex items-center justify-center p-8' 
      });
      
      const spinner = bridge.createElement('div', { 
        className: 'animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600' 
      });
      
      const text = bridge.createElement('span', { 
        className: 'ml-3 text-gray-600' 
      }, message);
      
      container.appendChild(spinner);
      container.appendChild(text);
      
      return container;
    },

    // Modal básico
    createModal: (title, content, onClose) => {
      const bridge = this.getBridge();
      
      const overlay = bridge.createElement('div', { 
        className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50',
        onclick: onClose
      });
      
      const modal = bridge.createElement('div', { 
        className: 'relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white',
        onclick: (e) => e.stopPropagation()
      });
      
      const header = bridge.createElement('div', { className: 'flex justify-between items-center mb-4' });
      const titleEl = bridge.createElement('h3', { className: 'text-lg font-medium' }, title);
      const closeBtn = bridge.createElement('button', { 
        className: 'text-gray-400 hover:text-gray-600',
        onclick: onClose
      }, '✕');
      
      header.appendChild(titleEl);
      header.appendChild(closeBtn);
      
      modal.appendChild(header);
      
      if (typeof content === 'string') {
        const contentEl = bridge.createElement('div', { className: 'mb-4' }, content);
        modal.appendChild(contentEl);
      } else {
        modal.appendChild(content);
      }
      
      overlay.appendChild(modal);
      
      return overlay;
    },

    // Tabela simples
    createTable: (headers, rows) => {
      const bridge = this.getBridge();
      
      const table = bridge.createElement('table', { className: 'min-w-full divide-y divide-gray-200' });
      
      // Header
      const thead = bridge.createElement('thead', { className: 'bg-gray-50' });
      const headerRow = bridge.createElement('tr');
      
      headers.forEach(header => {
        const th = bridge.createElement('th', { 
          className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' 
        }, header);
        headerRow.appendChild(th);
      });
      
      thead.appendChild(headerRow);
      table.appendChild(thead);
      
      // Body
      const tbody = bridge.createElement('tbody', { className: 'bg-white divide-y divide-gray-200' });
      
      rows.forEach(row => {
        const tr = bridge.createElement('tr');
        row.forEach(cell => {
          const td = bridge.createElement('td', { 
            className: 'px-6 py-4 whitespace-nowrap text-sm text-gray-900' 
          }, cell);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      
      table.appendChild(tbody);
      
      return table;
    }
  };
}

// Instância global do ModuleCore
const moduleCore = new ModuleCore();

// Disponibilizar globalmente
if (typeof window !== 'undefined') {
  window.ModuleCore = moduleCore;
}

// Para uso em módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ModuleCore;
}