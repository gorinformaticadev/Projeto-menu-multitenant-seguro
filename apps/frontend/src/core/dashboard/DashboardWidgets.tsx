/**
 * COMPONENTE DE WIDGETS DO DASHBOARD
 *
 * Usa o Module Registry para carregar widgets dinamicamente
 * Core agrega widgets de todos os módulos registrados
 */

"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { moduleRegistry, ModuleDashboardWidget } from "@/lib/module-registry";

const widgetComponents: Record<string, React.ComponentType<any>> = {
  WelcomeWidget: () => (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="mb-2 text-lg font-semibold">Bem-vindo!</h3>
      <p className="text-skin-text-muted">
        Sistema modular funcionando corretamente.
      </p>
    </div>
  ),

  StatsWidget: () => (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="mb-2 text-lg font-semibold">Estatisticas</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-skin-primary">42</div>
          <div className="text-sm text-skin-text-muted">Usuarios</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-skin-primary">12</div>
          <div className="text-sm text-skin-text-muted">Modulos</div>
        </div>
      </div>
    </div>
  ),

  SampleWidget: () => (
    <div className="rounded-lg border bg-card p-4">
      <h4 className="mb-1 font-medium">Modulo Sample</h4>
      <p className="text-sm text-skin-text-muted">Widget do modulo de exemplo</p>
    </div>
  ),
};

export function DashboardWidgets() {
  const { user } = useAuth();
  const [widgets, setWidgets] = useState<ModuleDashboardWidget[]>([]);

  useEffect(() => {
    try {
      setWidgets(moduleRegistry.getDashboardWidgets());
    } catch (error) {
      console.error("Erro ao carregar widgets:", error);
    }
  }, [user]);

  const getWidgetSizeClass = (size?: string) => {
    switch (size) {
      case "small":
        return "col-span-1";
      case "medium":
        return "col-span-2";
      case "large":
        return "col-span-3";
      default:
        return "col-span-1";
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {widgets.map((widget) => {
        const WidgetComponent =
          typeof widget.component === "string"
            ? widgetComponents[widget.component]
            : widget.component;

        if (!WidgetComponent) {
          console.warn(`Componente de widget nao encontrado: ${widget.component}`);
          return null;
        }

        return (
          <div key={widget.id} className={getWidgetSizeClass((widget as any).size)}>
            <WidgetComponent />
          </div>
        );
      })}
    </div>
  );
}
