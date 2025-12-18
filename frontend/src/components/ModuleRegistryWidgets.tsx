/**
 * COMPONENTE PARA WIDGETS DO MODULE REGISTRY
 * 
 * Integra widgets registrados no Module Registry ao dashboard
 */

"use client";

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { moduleRegistry, ModuleDashboardWidget } from '@/lib/module-registry';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, CheckCircle } from 'lucide-react';

// Cache de componentes de widgets carregados dinamicamente
const widgetComponentCache = new Map<string, React.ComponentType<any>>();

// Função para carregar widget dinamicamente de módulos independentes
const loadWidgetComponent = async (componentName: string, moduleName?: string): Promise<React.ComponentType<any> | null> => {
  // Verificar cache primeiro
  if (widgetComponentCache.has(componentName)) {
    return widgetComponentCache.get(componentName)!;
  }

  try {
    // Tentar carregar módulo independente
    if (moduleName && componentName === 'ExemploWidget') {
      try {
        // Carregar o código do widget independente via API
        const response = await fetch(`/api/modules/${moduleName}/frontend/components/${componentName}.js`);
        if (response.ok) {
          const widgetCode = await response.text();
          
          // Executar o código do widget JavaScript
          const widgetFunction = new Function('window', 'document', widgetCode);
          
          widgetFunction(window, document);
          
          // Criar componente React que renderiza o widget independente
          const IndependentWidget = () => {
            const containerRef = useRef<HTMLDivElement>(null);
            
            useEffect(() => {
              if (containerRef.current) {
                // Obter a função do widget
                const WidgetComponent = (window as any).ExemploWidget;
                
                if (WidgetComponent) {
                  const widgetInstance = WidgetComponent();
                  const renderedElement = widgetInstance.render();
                  
                  containerRef.current.innerHTML = '';
                  containerRef.current.appendChild(renderedElement);
                }
              }
            }, []);
            
            return <div ref={containerRef} />;
          };
          
          widgetComponentCache.set(componentName, IndependentWidget);
          return IndependentWidget;
        }
      } catch (error) {
        console.warn(`Widget independente ${componentName} não encontrado:`, error);
      }
    }

    // Fallback: widget integrado para compatibilidade
    if (componentName === 'ExemploWidget') {
      const FallbackWidget = () => (
        <Card className="w-full border-green-200 bg-green-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-900">
              <Package className="h-4 w-4" />
              Module Exemplo
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />
              Ativo (Fallback)
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 mb-2">
              Funcionando
            </div>
            <p className="text-xs text-green-700 mb-3">
              Widget fallback integrado (módulo independente não encontrado).
            </p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-green-600">Status:</span>
              <span className="font-medium text-green-700">Fallback Integrado</span>
            </div>
          </CardContent>
        </Card>
      );
      
      widgetComponentCache.set(componentName, FallbackWidget);
      return FallbackWidget;
    }

    return null;
  } catch (error) {
    console.error(`Erro ao carregar widget ${componentName}:`, error);
    return null;
  }
};

// Componentes de widgets disponíveis (agora dinâmico)
const widgetComponents: Record<string, React.ComponentType<any>> = {};

// Componente para carregar widgets dinamicamente
function DynamicWidget({ widget }: { widget: ModuleDashboardWidget }) {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadComponent();
  }, [widget.component]);

  const loadComponent = async () => {
    try {
      setLoading(true);
      
      // Tentar carregar dinamicamente
      const component = await loadWidgetComponent(widget.component, widget.module);
      
      if (component) {
        setComponent(() => component);
      } else {
        // Fallback para componentes hardcoded
        const fallbackComponent = widgetComponents[widget.component];
        if (fallbackComponent) {
          setComponent(() => fallbackComponent);
        }
      }
    } catch (error) {
      console.error(`Erro ao carregar widget ${widget.component}:`, error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center p-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  if (!Component) {
    return (
      <Card className="w-full border-orange-200 bg-orange-50/50">
        <CardContent className="p-4">
          <p className="text-sm text-orange-700">
            Widget "{widget.component}" não encontrado
          </p>
        </CardContent>
      </Card>
    );
  }

  return <Component />;
}

export function ModuleRegistryWidgets() {
  const { user } = useAuth();
  const [widgets, setWidgets] = useState<ModuleDashboardWidget[]>([]);

  useEffect(() => {
    loadWidgets();
  }, [user]);

  const loadWidgets = () => {
    try {
      // Core agrega widgets de todos os módulos registrados
      const moduleWidgets = moduleRegistry.getDashboardWidgets();
      setWidgets(moduleWidgets);
      console.log('📊 Widgets do Module Registry carregados:', moduleWidgets.length);
    } catch (error) {
      console.error('❌ Erro ao carregar widgets do Module Registry:', error);
    }
  };

  if (widgets.length === 0) {
    return null;
  }

  return (
    <>
      {widgets.map((widget) => {
        return (
          <DynamicWidget 
            key={widget.id} 
            widget={widget}
          />
        );
      })}
    </>
  );
}