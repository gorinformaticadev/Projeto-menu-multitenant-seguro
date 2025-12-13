"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useModuleMenus, ModuleMenu } from '@/hooks/useModuleMenus';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowLeft, Home } from 'lucide-react';

interface ModuleRouteHandlerProps {
  children?: React.ReactNode;
}

export function ModuleRouteHandler({ children }: ModuleRouteHandlerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { menus, loading, error } = useModuleMenus();
  const [isValidRoute, setIsValidRoute] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;

    // Verificar se a rota atual corresponde a algum menu de módulo
    const isModuleRoute = menus.some((menu: ModuleMenu) => {
      // Verificar rota principal
      if (menu.path === pathname) return true;
      
      // Verificar rotas filhas
      if (menu.children) {
        return menu.children.some((child: ModuleMenu) => child.path === pathname);
      }
      
      return false;
    });

    // Rotas do sistema que sempre são válidas
    const systemRoutes = [
      '/dashboard',
      '/perfil',
      '/empresas',
      '/usuarios',
      '/logs',
      '/configuracoes',
      '/login',
      '/esqueci-senha',
      '/redefinir-senha'
    ];

    const isSystemRoute = systemRoutes.some(route => 
      pathname === route || pathname.startsWith(route + '/')
    );

    setIsValidRoute(isSystemRoute || isModuleRoute);
  }, [menus, loading, pathname]);

  // Ainda carregando
  if (loading || isValidRoute === null) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Erro ao carregar módulos
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle>Erro ao Carregar Módulos</CardTitle>
            </div>
            <CardDescription>
              Não foi possível carregar os módulos do sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {error}
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => router.push('/dashboard')}
                variant="default"
                size="sm"
              >
                <Home className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                size="sm"
              >
                Tentar Novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Rota inválida
  if (!isValidRoute) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle>Página Não Encontrada</CardTitle>
            </div>
            <CardDescription>
              A página que você está procurando não existe ou não está disponível.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Rota: <code className="bg-muted px-1 py-0.5 rounded">{pathname}</code>
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => router.back()}
                variant="outline"
                size="sm"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button
                onClick={() => router.push('/dashboard')}
                variant="default"
                size="sm"
              >
                <Home className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Rota válida, renderizar conteúdo
  return <>{children}</>;
}