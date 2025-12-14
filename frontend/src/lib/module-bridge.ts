/**
 * MODULE BRIDGE - PONTE ENTRE MÓDULOS INDEPENDENTES E SISTEMA CORE
 * 
 * Permite que módulos independentes acessem funcionalidades do sistema principal
 * sem criar dependências diretas
 */

// Tipos para o bridge
export interface ModuleBridgeAPI {
  // Utilitários de UI
  createElement: (tag: string, props?: any, ...children: any[]) => HTMLElement;
  createButton: (text: string, onClick: () => void, variant?: 'primary' | 'secondary' | 'success' | 'danger') => HTMLElement;
  createCard: (title: string, content: HTMLElement | string) => HTMLElement;
  createAlert: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => HTMLElement;
  
  // Notificações (integração com sistema real)
  showNotification: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  
  // Navegação
  navigate: (path: string) => void;
  
  // Dados do usuário (mock para módulos independentes)
  getCurrentUser: () => Promise<any>;
  
  // Utilitários
  formatDate: (date: Date | string) => string;
  formatCurrency: (value: number) => string;
  
  // Classes CSS do sistema
  getSystemClasses: () => {
    button: {
      primary: string;
      secondary: string;
      success: string;
      danger: string;
    };
    card: string;
    alert: {
      info: string;
      success: string;
      warning: string;
      error: string;
    };
  };
}

export class ModuleBridge implements ModuleBridgeAPI {
  
  // Função helper para criar elementos DOM
  createElement(tag: string, props: any = {}, ...children: any[]): HTMLElement {
    const element = document.createElement(tag);
    
    // Aplicar propriedades
    Object.entries(props).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value as string;
      } else if (key.startsWith('on') && typeof value === 'function') {
        element.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
      } else if (key === 'innerHTML') {
        element.innerHTML = value as string;
      } else {
        element.setAttribute(key, value as string);
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
  }

  // Criar botão com estilos do sistema
  createButton(text: string, onClick: () => void, variant: 'primary' | 'secondary' | 'success' | 'danger' = 'primary'): HTMLElement {
    const classes = this.getSystemClasses();
    return this.createElement('button', {
      className: classes.button[variant],
      onclick: onClick
    }, text);
  }

  // Criar card com estilos do sistema
  createCard(title: string, content: HTMLElement | string): HTMLElement {
    const classes = this.getSystemClasses();
    const card = this.createElement('div', { className: classes.card });
    
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
  }

  // Criar alert com estilos do sistema
  createAlert(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): HTMLElement {
    const classes = this.getSystemClasses();
    const alert = this.createElement('div', { className: classes.alert[type] });
    
    const content = this.createElement('div', { className: 'flex' });
    
    const iconMap = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };
    
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
  }

  // Mostrar notificação (integração com sistema real)
  showNotification(title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    // Em um sistema real, isso integraria com o sistema de notificações
    // Por enquanto, usar alert para demonstração
    const typeEmoji = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };
    
    alert(`${typeEmoji[type]} ${title}\n\n${message}\n\n(Em um sistema real, isso apareceria no dropdown de notificações)`);
  }

  // Navegação (integração com Next.js router)
  navigate(path: string): void {
    // Em um sistema real, isso usaria o router do Next.js
    // Por enquanto, usar window.location
    if (typeof window !== 'undefined') {
      window.location.href = path;
    }
  }

  // Obter dados do usuário atual (mock)
  async getCurrentUser(): Promise<any> {
    // Em um sistema real, isso faria uma chamada à API
    // Por enquanto, retornar dados mock
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          id: 1,
          name: 'Usuário Exemplo',
          email: 'usuario@exemplo.com',
          role: 'admin',
          tenant: 'empresa-exemplo',
          permissions: ['read', 'write', 'admin']
        });
      }, 100);
    });
  }

  // Formatação de data
  formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Formatação de moeda
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  // Classes CSS do sistema (Tailwind)
  getSystemClasses() {
    return {
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
    };
  }
}

// Instância singleton do bridge
export const moduleBridge = new ModuleBridge();

// Disponibilizar globalmente para módulos
if (typeof window !== 'undefined') {
  (window as any).ModuleBridge = moduleBridge;
}