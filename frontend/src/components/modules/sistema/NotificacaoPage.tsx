"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell } from 'lucide-react';

/**
 * Página de Notificações do Módulo Sistema
 * Versão simplificada usando shadcn/ui
 */
export default function SistemaNotificacaoPage() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="h-8 w-8" />
        <h1 className="text-3xl font-bold">Notificações</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Central de Notificações</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Seu conteúdo de notificações vai aqui.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Sistema de notificações do módulo Sistema está ativo e funcionando.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
