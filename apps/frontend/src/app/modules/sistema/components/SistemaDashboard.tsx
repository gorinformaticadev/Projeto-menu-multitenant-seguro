import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function SistemaDashboard() {
    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold tracking-tight">Dashboard do Sistema</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Status do Sistema
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Online</div>
                        <p className="text-xs text-muted-foreground">
                            Todos os serviços operacionais
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
