/**
 * COMPONENTE DE EXEMPLO - DEMONSTRA O USO DO SISTEMA DE TOGGLE
 * 
 * Este componente mostra como usar o novo sistema centralizado
 * de gerenciamento de módulos com proteção contra spam
 */

import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { useModulesManager } from '@/hooks/useModulesManager';

export function ModuleToggleExample() {
  const { modules, loading, toggleModule, isToggling } = useModulesManager();

  const handleToggle = async (moduleName: string) => {
    // O sistema automaticamente:
    // 1. Verifica se já há uma operação em andamento
    // 2. Faz optimistic update da UI
    // 3. Executa a requisição no backend
    // 4. Confirma ou reverte baseado na resposta
    await toggleModule(moduleName);
  };

  if (loading) {
    return <div>Carregando módulos...</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Módulos Disponíveis</h3>
      {modules.map((module) => (
        <div key={module.name} className="flex items-center justify-between p-4 border rounded">
          <div>
            <h4 className="font-medium">{module.displayName}</h4>
            <p className="text-sm text-muted-foreground">{module.description}</p>
          </div>
          <div className="flex items-center gap-2">
            {isToggling(module.name) && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            <Switch
              checked={module.isActive}
              disabled={isToggling(module.name)}
              onCheckedChange={() => handleToggle(module.name)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}