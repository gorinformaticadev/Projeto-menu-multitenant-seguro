"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings } from 'lucide-react';

/**
 * Página de Ajustes do Módulo Sistema
 * Versão simplificada usando shadcn/ui
 */
export default function SistemaAjustesPage() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-8 w-8" />
        <h1 className="text-3xl font-bold">Ajustes</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Configurações do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Seu conteúdo de ajustes vai aqui.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Painel de configurações do módulo Sistema está ativo e funcionando.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
