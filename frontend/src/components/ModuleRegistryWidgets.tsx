/**
 * COMPONENTE PARA WIDGETS DO MODULE REGISTRY
 * 
 * Integra widgets registrados no Module Registry ao dashboard
 */

"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { moduleRegistry, ModuleDashboardWidget } from '@/lib/module-registry';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, CheckCircle } from 'lucide-react';

// Componentes de widgets disponíveis
const widgetComponents: Record<string, React.ComponentType<any>> = {
  ExemploWidget: () => (
    <Card className="w-full border-green-200 bg-green-50/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-900">
          <Package className="h-4 w-4" />
          Module Exemplo
        </CardTitle>
        <Badge variant="secondary" className="text-xs">
          <CheckCircle className="h-3 w-3 mr-1" />
          Ativo
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-green-600 mb-2">
          Funcionando
        </div>
        <p className="text-xs text-green-700 mb-3">
          Widget do Module Exemplo carregado com sucesso.
        </p>
        <div className="flex items-center justify-between text-xs">
          <span className="text-green-600">Status:</span>
          <span className="font-medium text-green-700">Integrado ao Core</span>
        </div>
      </CardContent>
    </Card>
  )
};

export function ModuleRegistryWidgets() {
  const { user } = useAuth();
  const [widgets, setWidgets] = useState<ModuleDashboardWidget[]>([]);

  useEffect(() => {
    loadWidgets();
  }, [user]);

  const loadWidgets = () => {
    try {
      // Core agrega widgets de todos os módulos registrados
      const moduleWidgets = moduleRegistry.getDashboardWidgets(user?.role);
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
        const WidgetComponent = widgetComponents[widget.component];
        
        if (!WidgetComponent) {
          console.warn(`⚠️ Componente de widget não encontrado: ${widget.component}`);
          return null;
        }

        return (
          <WidgetComponent key={widget.id} />
        );
      })}
    </>
  );
}