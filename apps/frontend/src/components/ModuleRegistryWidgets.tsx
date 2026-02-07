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
import * as LucideIcons from 'lucide-react';

// Helper para ícones dinâmicos
// Helper para ícones dinâmicos
const getIconComponent = (iconName: string): any => {
  const Icon = (LucideIcons as any)[iconName];
  return Icon || Package;
};

// Widget genérico para módulos
function GenericModuleWidget({ widget }: { widget: ModuleDashboardWidget }) {
  const Icon = getIconComponent(widget.icon || 'Package');
  const colors = getModuleColors(widget.module || 'default');

  // console.log('🟜️ [GenericModuleWidget] Renderizando widget:', widget.title);

  return (
    <Card className={`w-full ${colors.border} ${colors.bg}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className={`text-sm font-medium flex items-center gap-2 ${colors.title}`}>
          <Icon className="h-4 w-4" />
          {widget.title}
        </CardTitle>
        <Badge variant="secondary" className={`text-xs ${colors.badge}`}>
          <CheckCircle className="h-3 w-3 mr-1" />
          Ativo
        </Badge>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${colors.value} mb-2`}>
          Integrado ✓
        </div>
        <p className={`text-xs ${colors.description} mb-3`}>
          Módulo {widget.title} funcionando perfeitamente.
        </p>
        <div className="flex items-center justify-between text-xs">
          <span className={colors.label}>Status:</span>
          <span className={`font-medium ${colors.status}`}>Operacional</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Cores por módulo
function getModuleColors(moduleSlug: string) {
  type ColorScheme = {
    border: string;
    bg: string;
    title: string;
    badge: string;
    value: string;
    description: string;
    label: string;
    status: string;
  };
  const colorSchemes: Record<string, ColorScheme> = {
    sistema: {
      border: 'border-purple-200',
      bg: 'bg-purple-50/50',
      title: 'text-purple-900',
      badge: 'bg-purple-100',
      value: 'text-purple-600',
      description: 'text-purple-700',
      label: 'text-purple-600',
      status: 'text-purple-700'
    },
    default: {
      border: 'border-blue-200',
      bg: 'bg-blue-50/50',
      title: 'text-blue-900',
      badge: 'bg-blue-100',
      value: 'text-blue-600',
      description: 'text-blue-700',
      label: 'text-blue-600',
      status: 'text-blue-700'
    }
  };

  return colorSchemes[moduleSlug] || colorSchemes.default;
}

// Componente para carregar widgets dinamicamente
function DynamicWidget({ widget }: { widget: ModuleDashboardWidget }) {
  // Se o componente for uma função/classe (componente React), renderiza diretamente
  if (typeof widget.component === 'function' || typeof widget.component === 'object') {
    const Component = widget.component;
    return <Component />;
  }

  // Fallback para widget genérico se for string ou indefinido
  // console.log('🎭 [DynamicWidget] Usando widget genérico para:', widget.title);
  return <GenericModuleWidget widget={widget} />;
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
      // console.log('📊 [ModuleRegistryWidgets] Widgets carregados:', moduleWidgets.length);
      // console.log('📊 [ModuleRegistryWidgets] Detalhes:', moduleWidgets);
    } catch (error) {
      console.error('❌ [ModuleRegistryWidgets] Erro ao carregar widgets:', error);
    }
  };

  if (widgets.length === 0) {
    // console.log('⚠️ [ModuleRegistryWidgets] Nenhum widget para renderizar');
    return null;
  }

  // console.log('✅ [ModuleRegistryWidgets] Renderizando', widgets.length, 'widget(s)');

  return (
    <>
      {widgets.map((widget) => {
        // console.log('🎭 [ModuleRegistryWidgets] Renderizando widget:', widget.id, '- Component:', widget.component);
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