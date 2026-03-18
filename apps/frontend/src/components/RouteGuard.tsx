"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { isProtectedRoute, isAuthRoute, ROUTE_CONFIG } from '@/lib/routes';

interface RouteGuardProps {
  children: React.ReactNode;
}

interface AuthValidationResult {
  isValid: boolean;
  error?: string;
  shouldRedirect?: boolean;
}

export function RouteGuard({ children }: RouteGuardProps) {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [validationState, setValidationState] = useState<{
    loading: boolean;
    isValid: boolean;
    error?: string;
  }>({
    loading: true,
    isValid: false
  });

  // Usar regras centralizadas para decidir se precisa de proteção
  const needsProtection = isProtectedRoute(pathname);

  // Função para validar autenticação no backend
  const validateAuthentication = useCallback(async (): Promise<AuthValidationResult> => {
    try {
      // Se não tem token, não está autenticado
      if (!token) {
        return {
          isValid: false,
          error: 'Sessão não encontrada',
          shouldRedirect: true
        };
      }

      // Verificar se o token ainda é válido no backend
      await api.get('/auth/me');

      // Se chegou até aqui, o token é válido
      return {
        isValid: true
      };
    } catch (error: unknown) {
      console.error('❌ Erro na validação de autenticação:', error);

      // Analisar o tipo de erro
      const status = (error as { response?: { status?: number } })?.response?.status;
      const message = (error as { response?: { data?: { message?: string } }, message?: string })?.response?.data?.message || (error as { message?: string })?.message || 'Erro desconhecido';

      // Erros que indicam problemas de autenticação
      const authErrors = [
        'token inválido',
        'token expirado',
        'sessão expirada',
        'unauthorized',
        'jwt expired',
        'jwt malformed',
        'invalid token',
        'token expired',
        'access denied',
        'forbidden'
      ];

      const isAuthError = status === 401 ||
        status === 403 ||
        authErrors.some(err => message.toLowerCase().includes(err.toLowerCase()));

      return {
        isValid: false,
        error: isAuthError ? 'Sessão expirada ou inválida' : message,
        shouldRedirect: isAuthError
      };
    }
  }, [token]);

  // Efeito para validar autenticação quando necessário
  useEffect(() => {
    const performValidation = async () => {
      // Se não precisa de proteção, libera imediatamente
      if (!needsProtection) {
        setValidationState({
          loading: false,
          isValid: true
        });
        return;
      }

      // Se ainda está carregando auth context, aguarda
      if (authLoading) {
        return;
      }

      // Se não tem usuário, redireciona
      if (!user) {
        console.warn('⚠️ Usuário não autenticado tentando acessar rota protegida:', pathname);
        router.push(`${ROUTE_CONFIG.unauthenticatedFallback}?callbackUrl=${encodeURIComponent(pathname)}`);
        return;
      }

      // Validar autenticação no backend
      setValidationState({ loading: true, isValid: false });

      const validation = await validateAuthentication();

      if (!validation.isValid) {
        console.warn('⚠️ Falha na validação de autenticação:', {
          pathname,
          error: validation.error,
          shouldRedirect: validation.shouldRedirect
        });

        if (validation.shouldRedirect) {
          // Redirecionar para página de login (unauthenticatedFallback)
          router.push(ROUTE_CONFIG.unauthenticatedFallback);
          return;
        }
      }

      setValidationState({
        loading: false,
        isValid: validation.isValid,
        error: validation.error
      });
    };

    performValidation();
  }, [needsProtection, authLoading, user, token, pathname, router, validateAuthentication]);

  // Se não precisa de proteção, renderiza normalmente
  if (!needsProtection) {
    return <>{children}</>;
  }

  // Se ainda está validando, mostra loading
  if (validationState.loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground text-lg">Verificando autenticação...</p>
          <p className="text-sm text-muted-foreground mt-2">Aguarde um momento</p>
        </div>
      </div>
    );
  }

  // Se validação falhou, mostra erro
  if (!validationState.isValid) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-red-600 mb-2">Acesso Negado</h2>
          <p className="text-muted-foreground mb-4">
            Sua sessão expirou ou você não tem permissão para acessar esta página.
          </p>
          {validationState.error && (
            <p className="text-sm text-red-500 mb-4 bg-red-50 p-3 rounded-md border border-red-200">
              <strong>Erro:</strong> {validationState.error}
            </p>
          )}
          <div className="space-y-2">
            <button
              onClick={() => router.push(ROUTE_CONFIG.publicRoutes[0] || '/')}
              className="w-full bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-primary/90 transition-colors"
            >
              Voltar ao Início
            </button>
            <button
              onClick={() => router.push(ROUTE_CONFIG.unauthenticatedFallback)}
              className="w-full bg-secondary text-secondary-foreground px-6 py-2 rounded-md hover:bg-secondary/90 transition-colors"
            >
              Fazer Login Novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Se chegou até aqui, está tudo OK
  return <>{children}</>;
}

// Hook para usar o RouteGuard em componentes específicos
export function useRouteGuard() {
  const { user, token } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const checkAccess = async (): Promise<boolean> => {
    try {
      if (!token || !user) {
        return false;
      }

      const response = await api.get('/auth/me');
      return response.status === 200;
    } catch (error) {
      console.error('Erro na verificação de acesso:', error);
      return false;
    }
  };

  const redirectToHome = () => {
    router.push('/');
  };

  const redirectToLogin = () => {
    router.push('/login');
  };

  const isModuleRoute = pathname.startsWith('/modules/');
  const isProtected = isProtectedRoute(pathname);

  return {
    checkAccess,
    redirectToHome,
    redirectToLogin,
    isModuleRoute, // Mantido apenas para compatibilidade legada
    isProtected,
    isAuthenticated: !!user && !!token
  };
}