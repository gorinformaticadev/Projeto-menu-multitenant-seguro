/**
 * WIDGET DO MÓDULO SISTEMA PARA O DASHBOARD
 * 
 * Este widget aparece no dashboard principal do sistema
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, CheckCircle } from 'lucide-react';

export function SistemaWidget() {
  console.log('🟜️ [SistemaWidget] Widget sendo renderizado!');
  
  return (
    <Card className="w-full border-purple-200 bg-purple-50/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-purple-900">
          <Package className="h-4 w-4" />
          Módulo Sistema
        </CardTitle>
        <Badge variant="secondary" className="text-xs bg-purple-100">
          <CheckCircle className="h-3 w-3 mr-1" />
          Ativo
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-purple-600 mb-2">
          Integrado ✓
        </div>
        <p className="text-xs text-purple-700 mb-3">
          Módulo sistema funcionando perfeitamente no dashboard.
        </p>
        <div className="flex items-center justify-between text-xs">
          <span className="text-purple-600">Status:</span>
          <span className="font-medium text-purple-700">Operacional</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default SistemaWidget;
