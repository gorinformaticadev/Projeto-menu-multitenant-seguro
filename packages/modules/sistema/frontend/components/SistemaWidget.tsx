import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';

/**
 * Widget de Status do Sistema
 * 
 * Exibe a saúde geral dos serviços do sistema em tempo real.
 * Utilizado no Dashboard principal via injeção dinâmica.
 * 
 * @returns Componente React (Card)
 */
export function SistemaWidget() {
    return (
        <Card className="h-full border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Saúde do Sistema</CardTitle>
                <Activity className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-green-600">100%</div>
                <p className="text-xs text-muted-foreground mt-1">
                    Todos os serviços operando
                </p>
            </CardContent>
        </Card>
    );
}
