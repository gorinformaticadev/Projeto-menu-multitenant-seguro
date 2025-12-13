"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Save } from "lucide-react";

export default function ModeloConfigPage() {
    const { user } = useAuth();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Modelo Integrado - Configurações</h1>
            </div>

            <div className="grid gap-4 md:grid-cols-1">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Settings className="h-5 w-5" />
                            Preferências do Módulo
                        </CardTitle>
                        <CardDescription>
                            Ajuste as configurações específicas deste módulo.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-4 border rounded-md bg-muted/50">
                            <p className="text-sm text-muted-foreground">
                                Aqui você pode adicionar formulários para configurar o comportamento do módulo.
                                Exemplo: chaves de API, limites, preferências de exibição, etc.
                            </p>
                        </div>

                        <div className="flex justify-end">
                            <Button>
                                <Save className="mr-2 h-4 w-4" />
                                Salvar Alterações
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
