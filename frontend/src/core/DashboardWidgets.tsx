/**
 * COMPONENTE DE WIDGETS DO DASHBOARD
 * 
 * Usa o Module Registry para carregar widgets dinamicamente
 * Core agrega widgets de todos os módulos registrados
 */

"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { moduleRegistry } from '../../../../shared/registry/module-registry';
import { ModuleDashboardWidget } from '../../../../shared/types/module.types';

// Componentes de widgets disponíveis
const widgetComponents: Record<string, React.ComponentType<any>> = {
  WelcomeWidget: () => (
    <div className="p-6 bg-card rounded-lg border">
      <h3 className="text-lg font-semibold mb-2">Bem-vindo!</h3>
      <p className="text-muted-foreground">
        Sistema modular funcionando corretamente.
      </p>
    </div>
  ),
  
  StatsWidget: () => (
    <div className="p-6 bg-card rounded-lg border">
      <h3 className="text-lg font-semibold mb-2">Estatísticas</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-primary">42</div>
          <div className="text-sm text-muted-foreground">Usuários</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-primary">12</div>
          <div className="text-sm text-muted-foreground">Módulos</div>
        </div>
      </div>
    </div>
  ),
  
  SampleWidget: () => (
    <div className="p-4 bg-card rounded-lg border">
      <h4 className="font-medium mb-1">Módulo Sample</h4>
      <p className="text-sm text-muted-foreground">
        Widget do módulo de exemplo
      </p>
    </div>
  )
};

export function DashboardWidgets() {
  const { user } = useAuth();
  const [widgets, setWidgets] = useState<ModuleDashboardWidget[]>([]);

  useEffect(() => {
    loadWidgets();
  }, [user]);

  const loadWidgets = () => {
    try {
      // Core agrega widgets de todos os módulos registrados
      const moduleWidgets = moduleRegistry.getDashboardWidgets(user?.role, user?.permissions);
      setWidgets(moduleWidgets);
    } catch (error) {
      console.error('Erro ao carregar widgets:', error);
    }
  };

  const getWidgetSizeClass = (size?: string) => {
    switch (size) {
      case 'small':
        return 'col-span-1';
      case 'medium':
        return 'col-span-2';
      case 'large':
        return 'col-span-3';
      default:
        return 'col-span-1';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {widgets.map((widget) => {
        const WidgetComponent = widgetComponents[widget.component];
        
        if (!WidgetComponent) {
          console.warn(`Componente de widget não encontrado: ${widget.component}`);
          return null;
        }

        return (
          <div key={widget.id} className={getWidgetSizeClass(widget.size)}>
            <WidgetComponent />
          </div>
        );
      })}
    </div>
  );
}