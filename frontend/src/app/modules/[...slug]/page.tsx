/**
 * ROTEAMENTO DINÂMICO PARA MÓDULOS ROBUSTOS E INDEPENDENTES
 * 
 * Sistema que carrega módulos de forma segura e isolada
 * usando o ModuleLoader para descobrir e validar módulos
 */

"use client";

import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { moduleBridge } from '../../../lib/module-bridge';

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

      // Primeiro, descobrir módulos disponíveis via API
      console.log('🔍 Descobrindo módulos disponíveis...');
      const modulesResponse = await fetch('/api/modules/discover');
      
      if (!modulesResponse.ok) {
        throw new Error('Erro ao descobrir módulos disponíveis');
      }
      
      const { modules } = await modulesResponse.json();
      console.log('📦 Módulos descobertos:', modules);

      // Encontrar a página correspondente à rota
      let targetPage = null;
      let targetModule = null;

      for (const [moduleName, moduleData] of Object.entries(modules)) {
        const module = moduleData as any;
        if (!module.isValid || !module.config.enabled) continue;
        
        for (const page of module.bootstrap.pages) {
          // Normalizar paths para comparação
          const pagePath = page.path.replace(/^\//, '');
          const currentRoute = routeKey.replace(/^\//, '');
          
          if (pagePath === currentRoute) {
            targetPage = page;
            targetModule = moduleName;
            break;
          }
        }
        
        if (targetPage) break;
      }

      if (!targetPage || !targetModule) {
        throw new Error(`Rota não encontrada: ${routeKey}`);
      }

      console.log('🎯 Página encontrada:', targetPage);
      console.log('📦 Módulo:', targetModule);

      // Mapear para arquivo físico
      const modulePath = `/api/modules/${targetModule}/frontend/pages/${targetPage.id.split('.')[1]}.js`;
      const pageName = `${targetModule.charAt(0).toUpperCase() + targetModule.slice(1).replace(/-([a-z])/g, (g) => g[1].toUpperCase())}${targetPage.id.split('.')[1].charAt(0).toUpperCase() + targetPage.id.split('.')[1].slice(1)}Page`;

      // Carregar o arquivo do módulo via API
      console.log('🔄 Carregando módulo:', modulePath);
      
      const response = await fetch(modulePath);
      console.log('📡 Resposta recebida:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro na resposta:', response.status, errorText);
        throw new Error(`Módulo não encontrado: ${modulePath} (${response.status})`);
      }

      const moduleCode = await response.text();
      console.log('📄 Código do módulo carregado, tamanho:', moduleCode.length);
      
      // Verificar se o código não é HTML (página de erro)
      if (moduleCode.trim().startsWith('<')) {
        console.error('❌ Recebido HTML em vez de JavaScript');
        throw new Error('Recebido HTML em vez de JavaScript - verifique a API route');
      }
      
      // Carregar ModuleCore primeiro
      console.log('🔧 Carregando ModuleCore...');
      const coreResponse = await fetch('/api/modules/ModuleCore.js');
      console.log('📡 Resposta ModuleCore:', coreResponse.status, coreResponse.statusText);
      
      if (coreResponse.ok) {
        const coreCode = await coreResponse.text();
        console.log('📄 ModuleCore carregado, tamanho:', coreCode.length);
        
        const coreFunction = new Function('window', 'document', coreCode);
        coreFunction(window, document);
        
        console.log('✅ ModuleCore executado');
        console.log('🔍 window.ModuleCore disponível:', !!(window as any).ModuleCore);
      } else {
        console.warn('⚠️ ModuleCore não encontrado, módulo funcionará em modo básico');
      }
      
      // Disponibilizar o ModuleBridge globalmente para o módulo
      (window as any).ModuleBridge = moduleBridge;
      console.log('🌉 ModuleBridge disponibilizado globalmente');
      console.log('🔍 Tipo do moduleBridge:', typeof moduleBridge);
      
      // Executar o código do módulo JavaScript
      console.log('⚡ Executando código do módulo...');
      const moduleFunction = new Function('window', 'document', 'ModuleBridge', moduleCode);
      
      // Executar o módulo passando o bridge
      console.log('🚀 Executando módulo com parâmetros:', typeof window, typeof document, typeof moduleBridge);
      moduleFunction(window, document, moduleBridge);
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
      {/* O conteúdo do módulo será renderizado aqui */}
    </div>
  );
}