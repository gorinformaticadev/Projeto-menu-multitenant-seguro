"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { isProtectedRoute, ROUTE_CONFIG } from "@/lib/routes";

interface RouteGuardProps {
  children: React.ReactNode;
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
    isValid: false,
  });

  const needsProtection = isProtectedRoute(pathname);

  useEffect(() => {
    if (!needsProtection) {
      setValidationState({
        loading: false,
        isValid: true,
      });
      return;
    }

    if (authLoading) {
      setValidationState((current) => ({
        ...current,
        loading: true,
      }));
      return;
    }

    if (!user || !token) {
      setValidationState({
        loading: false,
        isValid: false,
        error: "Sessao expirada ou invalida",
      });
      router.replace(
        `${ROUTE_CONFIG.unauthenticatedFallback}?callbackUrl=${encodeURIComponent(pathname)}`,
      );
      return;
    }

    setValidationState({
      loading: false,
      isValid: true,
      error: undefined,
    });
  }, [needsProtection, authLoading, user, token, pathname, router]);

  if (!needsProtection) {
    return <>{children}</>;
  }

  if (validationState.loading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
          <p className="text-lg text-muted-foreground">Verificando autenticacao...</p>
          <p className="mt-2 text-sm text-muted-foreground">Aguarde um momento</p>
        </div>
      </div>
    );
  }

  if (!validationState.isValid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="mx-auto max-w-md p-6 text-center">
          <div className="mb-4 text-6xl text-red-500">Bloqueado</div>
          <h2 className="mb-2 text-2xl font-bold text-red-600">Acesso Negado</h2>
          <p className="mb-4 text-muted-foreground">
            Sua sessao expirou ou voce nao tem permissao para acessar esta pagina.
          </p>
          {validationState.error ? (
            <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-500">
              <strong>Erro:</strong> {validationState.error}
            </p>
          ) : null}
          <div className="space-y-2">
            <button
              onClick={() => router.push(ROUTE_CONFIG.publicRoutes[0] || "/")}
              className="w-full rounded-md bg-primary px-6 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Voltar ao Inicio
            </button>
            <button
              onClick={() => router.push(ROUTE_CONFIG.unauthenticatedFallback)}
              className="w-full rounded-md bg-secondary px-6 py-2 text-secondary-foreground transition-colors hover:bg-secondary/90"
            >
              Fazer Login Novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function useRouteGuard() {
  const { user, token } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const checkAccess = async (): Promise<boolean> => Boolean(token && user);

  const redirectToHome = () => {
    router.push("/");
  };

  const redirectToLogin = () => {
    router.push("/login");
  };

  const isModuleRoute = pathname.startsWith("/modules/");
  const isProtected = isProtectedRoute(pathname);

  return {
    checkAccess,
    redirectToHome,
    redirectToLogin,
    isModuleRoute,
    isProtected,
    isAuthenticated: !!user && !!token,
  };
}
