import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
    children?: ReactNode;
    moduleName?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ModuleErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("ModuleErrorBoundary caught an error:", error, errorInfo);
    }

    public handleRetry = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex items-center justify-center p-6 h-full min-h-[400px]">
                    <Card className="w-full max-w-md border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900">
                        <CardHeader className="text-center">
                            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
                                <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                            </div>
                            <CardTitle className="text-xl text-red-700 dark:text-red-400">
                                Erro no Módulo {this.props.moduleName}
                            </CardTitle>
                            <CardDescription className="text-red-600/80 dark:text-red-400/80">
                                Ocorreu um problema ao carregar este componente.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-center text-muted-foreground">
                                Isso pode ser devido a uma falha temporária ou um problema de configuração.
                                O sistema isolou este erro para não afetar o resto da aplicação.
                            </p>
                            {process.env.NODE_ENV === 'development' && this.state.error && (
                                <div className="mt-4 p-2 bg-black/5 rounded text-xs overflow-auto max-h-32 text-left font-mono">
                                    {this.state.error.message}
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="justify-center">
                            <Button onClick={this.handleRetry} variant="outline" className="border-red-200 hover:bg-red-100 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-900/50">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Tentar Novamente
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}
