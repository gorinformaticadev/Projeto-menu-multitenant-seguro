/**
 * MODULE CORE ROBUSTO - SISTEMA SEGURO PARA MÓDULOS INDEPENDENTES
 * 
 * Fornece bridge seguro e isolado para módulos
 * Implementa validações de segurança e controle de acesso
 */

class ModuleCore {
  constructor() {
    this.bridge = null;
    this.ready = false;
    this.securityLevel = 'strict'; // strict, moderate, permissive
    this.allowedDomains = ['localhost', '127.0.0.1']; // Domínios permitidos
    this.moduleRegistry = new Map();
    this.eventListeners = new Map();
    
    // Componentes disponíveis
    this.components = {
      createLoader: this.createLoader.bind(this),
      createAlert: this.createAlert.bind(this),
      createCard: this.createCard.bind(this),
      createButton: this.createButton.bind(this),
      createForm: this.createForm.bind(this),
      createModal: this.createModal.bind(this),
      createTable: this.createTable.bind(this)
    };
    
    // Utilitários seguros
    this.utils = {
      generateId: this.generateId.bind(this),
      debounce: this.debounce.bind(this),
      isValidEmail: this.isValidEmail.bind(this),
      capitalize: this.capitalize.bind(this),
      truncate: this.truncate.bind(this),
      sanitizeText: this.sanitizeText.bind(this),
      sanitizeHTML: this.sanitizeHTML.bind(this)
    };
    
    // Inicializar validações de segurança
    this.initSecurity();
  }

  /**
   * Inicializa validações de segurança
   */
  initSecurity() {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const isSecure = this.allowedDomains.includes(hostname) || hostname.endsWith('.local');
      
      if (!isSecure && this.securityLevel === 'strict') {
        console.warn('⚠️ ModuleCore: Ambiente não seguro detectado');
      }
      
      // Prevenir modificações maliciosas
      Object.freeze(this.allowedDomains);
    }
  }

  /**
   * Registra um módulo no sistema
   */
  registerModule(moduleId, moduleConfig) {
    if (!this.validateModuleConfig(moduleConfig)) {
      throw new Error(`Configuração inválida para módulo: ${moduleId}`);
    }
    
    this.moduleRegistry.set(moduleId, {
      ...moduleConfig,
      registeredAt: new Date(),
      active: true
    });
    
    console.log(`✅ Módulo registrado: ${moduleId}`);
    this.emitEvent('module:registered', { moduleId, config: moduleConfig });
  }

  /**
   * Valida configuração do módulo
   */
  validateModuleConfig(config) {
    const requiredFields = ['name', 'version', 'sandboxed'];
    
    for (const field of requiredFields) {
      if (!(field in config)) {
        console.error(`❌ Campo obrigatório ausente: ${field}`);
        return false;
      }
    }
    
    // Verificar se o módulo está em sandbox (obrigatório em modo strict)
    if (this.securityLevel === 'strict' && !config.sandboxed) {
      console.error('❌ Módulo deve estar em sandbox no modo strict');
      return false;
    }
    
    return true;
  }

  /**
   * Inicializa o ModuleCore com um bridge opcional
   */
  init(bridge = null) {
    try {
      this.bridge = bridge || this.createSecureBridge();
      this.ready = true;
      
      console.log('🔧 ModuleCore inicializado', bridge ? 'com bridge do sistema' : 'com bridge seguro');
      this.emitEvent('core:initialized', { bridge: !!bridge });
      
    } catch (error) {
      console.error('❌ Erro ao inicializar ModuleCore:', error);
      this.ready = false;
    }
  }

  /**
   * Verifica se o ModuleCore está pronto
   */
  isReady() {
    return this.ready;
  }

  /**
   * Obtém o bridge atual
   */
  getBridge() {
    if (!this.ready) {
      console.warn('⚠️ ModuleCore não está pronto. Chame init() primeiro.');
      return null;
    }
    return this.bridge;
  }

  /**
   * Cria um bridge seguro para modo independente
   */
  createSecureBridge() {
    const self = this;
    
    return {
      // Criação segura de elementos
      createElement: (tag, props = {}, ...children) => {
        // Validar tag permitida
        const allowedTags = ['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'button', 'input', 'textarea', 'select', 'option', 'label', 'form', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'img'];
        
        if (!allowedTags.includes(tag.toLowerCase())) {
          console.warn(`⚠️ Tag não permitida: ${tag}`);
          tag = 'div'; // Fallback seguro
        }
        
        const element = document.createElement(tag);
        
        // Aplicar propriedades com validação
        Object.entries(props).forEach(([key, value]) => {
          if (key === 'className') {
            element.className = self.sanitizeClassName(value);
          } else if (key.startsWith('on') && typeof value === 'function') {
            // Validar eventos permitidos
            const allowedEvents = ['click', 'change', 'input', 'submit', 'focus', 'blur', 'keyup', 'keydown'];
            const eventName = key.slice(2).toLowerCase();
            
            if (allowedEvents.includes(eventName)) {
              element.addEventListener(eventName, (e) => {
                try {
                  value(e);
                } catch (error) {
                  console.error('❌ Erro no handler de evento:', error);
                  self.emitEvent('event:error', { error: error.message, event: eventName });
                }
              });
            } else {
              console.warn(`⚠️ Evento não permitido: ${eventName}`);
            }
          } else if (key === 'innerHTML') {
            element.innerHTML = self.sanitizeHTML(value);
          } else {
            // Validar atributos seguros
            const safeAttributes = ['id', 'type', 'placeholder', 'value', 'disabled', 'readonly', 'required', 'src', 'alt', 'title'];
            if (safeAttributes.includes(key)) {
              element.setAttribute(key, self.sanitizeText(value));
            }
          }
        });
        
        // Adicionar filhos com validação
        children.forEach(child => {
          if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
          } else if (child instanceof HTMLElement) {
            element.appendChild(child);
          }
        });
        
        return element;
      },
      
      // Notificações seguras
      showNotification: (title, message, type = 'info') => {
        title = self.sanitizeText(title);
        message = self.sanitizeText(message);
        
        const allowedTypes = ['info', 'success', 'warning', 'error'];
        if (!allowedTypes.includes(type)) {
          type = 'info';
        }
        
        const typeEmoji = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };
        
        // Em um sistema real, isso integraria com o sistema de notificações
        alert(`${typeEmoji[type]} ${title}\n\n${message}`);
        
        self.emitEvent('notification:shown', { title, message, type });
      },
      
      // Criação segura de botões
      createButton: (text, onClick, variant = 'primary') => {
        return self.createButton(text, onClick, variant);
      },
      
      // Criação segura de cards
      createCard: (title, content) => {
        return self.createCard(title, content);
      },
      
      // Criação segura de alertas
      createAlert: (message, type = 'info') => {
        return self.createAlert(message, type);
      },
      
      // Dados do usuário (mock seguro)
      getCurrentUser: async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return {
          id: 1,
          name: 'Usuário Exemplo',
          email: 'usuario@exemplo.com',
          role: 'admin',
          tenant: 'empresa-exemplo',
          permissions: ['read', 'write', 'admin']
        };
      },
      
      // Formatação segura de data
      formatDate: (date) => {
        try {
          const d = typeof date === 'string' ? new Date(date) : date;
          if (isNaN(d.getTime())) {
            return 'Data inválida';
          }
          return d.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        } catch (error) {
          console.error('❌ Erro ao formatar data:', error);
          return 'Erro na data';
        }
      },
      
      // Formatação de moeda
      formatCurrency: (value) => {
        try {
          return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          }).format(value);
        } catch (error) {
          return `R$ ${value.toFixed(2)}`;
        }
      },
      
      // Navegação segura
      navigate: (path) => {
        if (typeof window !== 'undefined' && typeof path === 'string') {
          // Validar path
          if (path.startsWith('/') && !path.includes('..')) {
            window.location.href = path;
          } else {
            console.warn('⚠️ Path de navegação inválido:', path);
          }
        }
      },
      
      // Classes CSS do sistema
      getSystemClasses: () => ({
        button: {
          primary: 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500',
          secondary: 'px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500',
          success: 'px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500',
          danger: 'px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500'
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

  /**
   * Sanitiza texto para prevenir XSS
   */
  sanitizeText(text) {
    if (typeof text !== 'string') {
      return String(text);
    }
    
    return text
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Sanitiza HTML básico
   */
  sanitizeHTML(html) {
    if (typeof html !== 'string') {
      return '';
    }
    
    // Remover scripts e outros elementos perigosos
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  /**
   * Sanitiza classes CSS
   */
  sanitizeClassName(className) {
    if (typeof className !== 'string') {
      return '';
    }
    
    // Permitir apenas classes CSS válidas (Tailwind)
    return className
      .split(' ')
      .filter(cls => /^[a-zA-Z0-9\-_:]+$/.test(cls))
      .join(' ');
  }

  /**
   * Emite eventos do sistema
   */
  emitEvent(eventName, data = {}) {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      const event = new CustomEvent(`modulecore:${eventName}`, {
        detail: { ...data, timestamp: new Date() }
      });
      window.dispatchEvent(event);
    }
    
    // Notificar listeners internos
    const listeners = this.eventListeners.get(eventName) || [];
    listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('❌ Erro no listener de evento:', error);
      }
    });
  }

  /**
   * Adiciona listener de evento
   */
  addEventListener(eventName, listener) {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, []);
    }
    this.eventListeners.get(eventName).push(listener);
  }

  /**
   * Remove listener de evento
   */
  removeEventListener(eventName, listener) {
    const listeners = this.eventListeners.get(eventName) || [];
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  /**
   * COMPONENTES AUXILIARES
   */

  createLoader(message = 'Carregando...') {
    const bridge = this.getBridge();
    if (!bridge) return null;
    
    const loader = bridge.createElement('div', { 
      className: 'flex items-center justify-center p-8' 
    });
    
    const spinner = bridge.createElement('div', { 
      className: 'animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600' 
    });
    
    const text = bridge.createElement('span', { 
      className: 'ml-3 text-gray-600' 
    }, this.sanitizeText(message));
    
    loader.appendChild(spinner);
    loader.appendChild(text);
    
    return loader;
  }

  createAlert(message, type = 'info') {
    const bridge = this.getBridge();
    if (!bridge) return null;
    
    const types = {
      info: 'bg-blue-50 border border-blue-200 text-blue-800',
      success: 'bg-green-50 border border-green-200 text-green-800',
      warning: 'bg-yellow-50 border border-yellow-200 text-yellow-800',
      error: 'bg-red-50 border border-red-200 text-red-800'
    };
    
    const alert = bridge.createElement('div', { 
      className: `${types[type] || types.info} rounded-lg p-4` 
    });
    
    const content = bridge.createElement('div', { className: 'flex' });
    
    const iconMap = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };
    
    const icon = bridge.createElement('div', { className: 'flex-shrink-0' });
    const iconSpan = bridge.createElement('span', { className: 'h-5 w-5' }, iconMap[type] || iconMap.info);
    icon.appendChild(iconSpan);
    
    const messageEl = bridge.createElement('div', { className: 'ml-3' });
    const messageText = bridge.createElement('p', { className: 'text-sm' }, this.sanitizeText(message));
    messageEl.appendChild(messageText);
    
    content.appendChild(icon);
    content.appendChild(messageEl);
    alert.appendChild(content);
    
    return alert;
  }

  createCard(title, content) {
    const bridge = this.getBridge();
    if (!bridge) return null;
    
    const card = bridge.createElement('div', { 
      className: 'bg-white shadow overflow-hidden sm:rounded-lg mb-6' 
    });
    
    const header = bridge.createElement('div', { className: 'px-4 py-5 sm:p-6' });
    const titleEl = bridge.createElement('h3', { 
      className: 'text-lg leading-6 font-medium text-gray-900 mb-4' 
    }, this.sanitizeText(title));
    
    header.appendChild(titleEl);
    
    if (typeof content === 'string') {
      const contentEl = bridge.createElement('div', { 
        className: 'text-sm text-gray-600' 
      }, this.sanitizeText(content));
      header.appendChild(contentEl);
    } else if (content instanceof HTMLElement) {
      header.appendChild(content);
    }
    
    card.appendChild(header);
    return card;
  }

  createButton(text, onClick, variant = 'primary') {
    const bridge = this.getBridge();
    if (!bridge) return null;
    
    const variants = {
      primary: 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500',
      secondary: 'px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500',
      success: 'px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500',
      danger: 'px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500'
    };
    
    const button = bridge.createElement('button', {
      className: variants[variant] || variants.primary,
      onclick: typeof onClick === 'function' ? onClick : () => {}
    }, this.sanitizeText(text));
    
    return button;
  }

  createForm(config) {
    const bridge = this.getBridge();
    if (!bridge) return null;
    
    const form = bridge.createElement('form', { className: 'space-y-4' });
    
    if (config.fields) {
      config.fields.forEach(field => {
        const fieldContainer = bridge.createElement('div');
        
        if (field.label) {
          const label = bridge.createElement('label', { 
            className: 'block text-sm font-medium text-gray-700 mb-1' 
          }, this.sanitizeText(field.label));
          fieldContainer.appendChild(label);
        }
        
        const input = bridge.createElement(field.type === 'textarea' ? 'textarea' : 'input', {
          className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500',
          type: field.type !== 'textarea' ? field.type : undefined,
          placeholder: field.placeholder ? this.sanitizeText(field.placeholder) : undefined,
          id: field.id || undefined
        });
        
        fieldContainer.appendChild(input);
        form.appendChild(fieldContainer);
      });
    }
    
    return form;
  }

  createModal(title, content, onClose) {
    const bridge = this.getBridge();
    if (!bridge) return null;
    
    const overlay = bridge.createElement('div', { 
      className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50',
      onclick: onClose
    });
    
    const modal = bridge.createElement('div', { 
      className: 'relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white',
      onclick: (e) => e.stopPropagation()
    });
    
    const header = bridge.createElement('div', { className: 'flex justify-between items-center mb-4' });
    const titleEl = bridge.createElement('h3', { className: 'text-lg font-medium' }, this.sanitizeText(title));
    const closeBtn = bridge.createElement('button', { 
      className: 'text-gray-400 hover:text-gray-600',
      onclick: onClose
    }, '✕');
    
    header.appendChild(titleEl);
    header.appendChild(closeBtn);
    modal.appendChild(header);
    
    if (typeof content === 'string') {
      const contentEl = bridge.createElement('div', { className: 'mb-4' }, this.sanitizeText(content));
      modal.appendChild(contentEl);
    } else if (content instanceof HTMLElement) {
      modal.appendChild(content);
    }
    
    overlay.appendChild(modal);
    return overlay;
  }

  createTable(headers, rows) {
    const bridge = this.getBridge();
    if (!bridge) return null;
    
    const table = bridge.createElement('table', { className: 'min-w-full divide-y divide-gray-200' });
    
    // Header
    const thead = bridge.createElement('thead', { className: 'bg-gray-50' });
    const headerRow = bridge.createElement('tr');
    
    headers.forEach(header => {
      const th = bridge.createElement('th', { 
        className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' 
      }, this.sanitizeText(header));
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
        }, this.sanitizeText(cell));
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    return table;
  }

  /**
   * UTILITÁRIOS SEGUROS
   */

  generateId() {
    return 'module_' + Math.random().toString(36).substr(2, 9);
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  truncate(str, length = 100) {
    return str.length > length ? str.substring(0, length) + '...' : str;
  }

  /**
   * Obtém estatísticas do sistema
   */
  getStats() {
    return {
      ready: this.ready,
      securityLevel: this.securityLevel,
      registeredModules: this.moduleRegistry.size,
      bridgeType: this.bridge ? 'active' : 'none',
      eventListeners: this.eventListeners.size
    };
  }
}

// Instância singleton do ModuleCore
const moduleCore = new ModuleCore();

// Disponibilizar globalmente com proteção
if (typeof window !== 'undefined') {
  if (!window.ModuleCore) {
    window.ModuleCore = moduleCore;
    console.log('🔧 ModuleCore robusto disponibilizado globalmente');
  }
}

// Para uso em módulos Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ModuleCore;
}