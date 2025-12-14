/**
 * ROTEAMENTO DINÂMICO PARA MÓDULOS INDEPENDENTES
 * 
 * Carrega módulos verdadeiramente independentes da pasta modules/
 * Sem dependências do React ou outros sistemas externos
 */

"use client";

import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export default function DynamicModulePage() {
  const params = useParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const slug = Array.isArray(params.slug) ? params.slug : [params.slug];
  const routeKey = slug.join('/');

  useEffect(() => {
    loadModule();
  }, [routeKey]);

  const loadModule = async () => {
    try {
      setLoading(true);
      setError(null);

      // Mapear rotas para arquivos de módulo
      let modulePath = '';
      let pageName = '';

      if (routeKey === 'module-exemplo') {
        modulePath = '/api/modules/module-exemplo/frontend/pages/index.js';
        pageName = 'ModuleExemploPage';
      } else if (routeKey === 'module-exemplo/settings') {
        modulePath = '/api/modules/module-exemplo/frontend/pages/settings.js';
        pageName = 'ModuleExemploSettingsPage';
      } else {
        throw new Error(`Rota não encontrada: ${routeKey}`);
      }

      // Carregar o arquivo do módulo via API
      console.log('🔄 Carregando módulo:', modulePath);
      console.log('🌐 URL completa:', window.location.origin + modulePath);
      
      const response = await fetch(modulePath);
      console.log('📡 Resposta recebida:', response.status, response.statusText);
      console.log('📋 Headers da resposta:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro na resposta:', response.status, errorText);
        throw new Error(`Módulo não encontrado: ${modulePath} (${response.status})`);
      }

      const moduleCode = await response.text();
      console.log('📄 Código do módulo carregado (primeiros 200 chars):', moduleCode.substring(0, 200));
      console.log('📄 Tipo de conteúdo:', typeof moduleCode, 'Tamanho:', moduleCode.length);
      
      // Verificar se o código não é HTML (página de erro)
      if (moduleCode.trim().startsWith('<')) {
        console.error('❌ Recebido HTML:', moduleCode.substring(0, 500));
        throw new Error('Recebido HTML em vez de JavaScript - verifique a API route');
      }
      
      // Executar o código do módulo JavaScript
      console.log('⚡ Executando código do módulo...');
      const moduleFunction = new Function('window', 'document', moduleCode);
      
      // Executar o módulo
      moduleFunction(window, document);
      console.log('✅ Módulo executado com sucesso');
      
      // Obter a função do módulo
      let ModuleComponent;
      if ((window as any)[pageName]) {
        ModuleComponent = (window as any)[pageName];
        console.log('🎯 Componente encontrado:', pageName);
      } else {
        console.error('❌ Componente não encontrado. Window keys:', Object.keys(window).filter(k => k.includes('Module')));
        throw new Error(`Componente ${pageName} não encontrado no módulo`);
      }

      // Renderizar o módulo
      if (containerRef.current && ModuleComponent) {
        console.log('🎨 Renderizando módulo...');
        const moduleInstance = ModuleComponent();
        
        if (!moduleInstance || typeof moduleInstance.render !== 'function') {
          throw new Error('Módulo não retornou uma instância válida com método render()');
        }
        
        const renderedElement = moduleInstance.render();
        
        if (!renderedElement || !renderedElement.appendChild) {
          throw new Error('Método render() não retornou um elemento DOM válido');
        }
        
        // Limpar container e adicionar o elemento renderizado
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(renderedElement);
        console.log('✅ Módulo renderizado com sucesso');
      }

    } catch (err) {
      console.error('Erro ao carregar módulo:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-2xl">
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Carregando módulo...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-2xl">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800 mb-2">
            <span>⚠️</span>
            <h3 className="font-medium">Erro ao carregar módulo</h3>
          </div>
          <p className="text-red-700 text-sm mb-4">{error}</p>
          <div className="p-3 bg-red-100 rounded-lg">
            <p className="text-sm font-medium text-red-900 mb-2">Rotas disponíveis:</p>
            <ul className="text-sm text-red-800 space-y-1">
              <li>• <code>/modules/module-exemplo</code></li>
              <li>• <code>/modules/module-exemplo/settings</code></li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-screen">
      /**
 * PÁGINA PRINCIPAL DO MODULE EXEMPLO
 * 
 * Versão standalone do módulo - completamente independente
 * JavaScript puro, sem dependências externas
 */

function ModuleExemploPage() {
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
    
    const iconDiv = createElement('div', { className: 'p-2 bg-blue-100 rounded-lg' });
    const icon = createElement('div', { 
      className: 'h-6 w-6 text-blue-600',
      innerHTML: '📦'
    });
    iconDiv.appendChild(icon);
    
    const textDiv = createElement('div');
    const title = createElement('h1', { className: 'text-2xl font-bold text-gray-900' }, 'Module Exemplo');
    const subtitle = createElement('p', { className: 'text-gray-600' }, 'Demonstração do sistema modular');
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
    
    // Funcionalidades do Módulo
    const featuresCard = createElement('div', { className: 'bg-white shadow overflow-hidden sm:rounded-md' });
    const featuresContent = createElement('div', { className: 'px-4 py-5 sm:p-6' });
    
    const featuresTitle = createElement('h3', { 
      className: 'text-lg leading-6 font-medium text-gray-900 mb-4' 
    }, 'Funcionalidades do Módulo');
    
    const featuresDesc = createElement('p', { 
      className: 'text-sm text-gray-600 mb-6' 
    }, 'Este módulo demonstra a integração completa com o sistema modular');
    
    const featuresGrid = createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-6' });
    
    // Lista de funcionalidades implementadas
    const implementedDiv = createElement('div', { className: 'space-y-3' });
    const implementedTitle = createElement('h4', { className: 'font-medium text-gray-900' }, '✅ Implementado');
    const implementedList = createElement('ul', { className: 'text-sm text-gray-600 space-y-2' });
    
    const features = [
      'Carregamento dinâmico de páginas',
      'Integração com menu lateral',
      'Widget no dashboard',
      'Sistema de notificações',
      'Menu do usuário'
    ];
    
    features.forEach(feature => {
      const li = createElement('li', { className: 'flex items-center' });
      const icon = createElement('span', { className: 'h-4 w-4 text-green-500 mr-2' }, '✓');
      const text = createElement('span', {}, feature);
      li.appendChild(icon);
      li.appendChild(text);
      implementedList.appendChild(li);
    });
    
    implementedDiv.appendChild(implementedTitle);
    implementedDiv.appendChild(implementedList);
    
    // Lista de funcionalidades automáticas
    const automaticDiv = createElement('div', { className: 'space-y-3' });
    const automaticTitle = createElement('h4', { className: 'font-medium text-gray-900' }, '🔄 Automático');
    const automaticList = createElement('ul', { className: 'text-sm text-gray-600 space-y-2' });
    
    const automaticFeatures = [
      'Registro automático no sistema',
      'Ativação por tenant',
      'Carregamento sob demanda',
      'Cache inteligente',
      'Isolamento por módulo'
    ];
    
    automaticFeatures.forEach(feature => {
      const li = createElement('li', { className: 'flex items-center' });
      const icon = createElement('span', { className: 'h-4 w-4 text-blue-500 mr-2' }, '🔄');
      const text = createElement('span', {}, feature);
      li.appendChild(icon);
      li.appendChild(text);
      automaticList.appendChild(li);
    });
    
    automaticDiv.appendChild(automaticTitle);
    automaticDiv.appendChild(automaticList);
    
    featuresGrid.appendChild(implementedDiv);
    featuresGrid.appendChild(automaticDiv);
    
    featuresContent.appendChild(featuresTitle);
    featuresContent.appendChild(featuresDesc);
    featuresContent.appendChild(featuresGrid);
    featuresCard.appendChild(featuresContent);
    
    // Informações Técnicas
    const infoBox = createElement('div', { className: 'mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4' });
    const infoHeader = createElement('div', { className: 'flex' });
    
    const infoIcon = createElement('div', { className: 'flex-shrink-0' });
    const infoIconSpan = createElement('span', { className: 'h-5 w-5 text-blue-400' }, 'ℹ️');
    infoIcon.appendChild(infoIconSpan);
    
    const infoContent = createElement('div', { className: 'ml-3' });
    const infoTitle = createElement('h3', { className: 'text-sm font-medium text-blue-800' }, 'Módulo Independente');
    const infoText = createElement('p', { className: 'mt-2 text-sm text-blue-700' }, 
      'Este módulo está sendo carregado dinamicamente da pasta modules/module-exemplo/ e é completamente independente, sem dependências externas.'
    );
    
    infoContent.appendChild(infoTitle);
    infoContent.appendChild(infoText);
    infoHeader.appendChild(infoIcon);
    infoHeader.appendChild(infoContent);
    infoBox.appendChild(infoHeader);
    
    // Montar tudo
    container.appendChild(header);
    container.appendChild(cardsGrid);
    container.appendChild(featuresCard);
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
      {/* O conteúdo do módulo será renderizado aqui */}
    </div>
  );
}