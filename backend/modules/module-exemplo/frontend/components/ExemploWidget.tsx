/**
 * WIDGET DO MODULE EXEMPLO PARA DASHBOARD
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, CheckCircle } from "lucide-react";

export function ExemploWidget() {
  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
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
        <p className="text-xs text-muted-foreground mb-3">
          Widget do Module Exemplo carregado com sucesso.
        </p>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Status:</span>
          <span className="font-medium text-green-600">Integrado ao Core</span>
        </div>
      </CardContent>
    </Card>
  );
}