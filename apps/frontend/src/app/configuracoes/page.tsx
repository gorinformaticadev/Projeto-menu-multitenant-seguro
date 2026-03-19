"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { getConfigurationPanelItems } from "@/lib/configuration-menu";
import { ArrowRight, LayoutDashboard, Settings2, UserRound } from "lucide-react";

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const visibleItems = getConfigurationPanelItems(user?.role);

  return (
    <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        <section className="rounded-[2rem] border border-border/70 bg-skin-surface p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-skin-primary/15 bg-skin-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-skin-primary">
                <Settings2 className="h-4 w-4" />
                Central de Configurações
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight text-skin-text">
                Ajustes organizados em navegação rápida
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-skin-text-muted md:text-base">
                O painel lateral interno foi removido desta página. Use o menu horizontal no topo para ir direto
                para Segurança, Notificações Push, Identidade da Plataforma, Diagnóstico Operacional e as demais
                áreas liberadas para o seu perfil.
              </p>
            </div>

            <div className="grid min-w-0 gap-3 sm:min-w-[260px]">
              <div className="rounded-2xl border border-border/70 bg-skin-surface/70 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-skin-primary/10 text-skin-primary">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-skin-text-muted">
                      Perfil atual
                    </p>
                    <p className="truncate text-sm font-semibold text-skin-text">{user?.name}</p>
                    <p className="text-xs text-skin-text-muted">{user?.role}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-skin-surface/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-skin-text-muted">
                  Áreas disponíveis
                </p>
                <p className="mt-2 text-3xl font-bold text-skin-text">{visibleItems.length}</p>
                <p className="mt-1 text-sm text-skin-text-muted">
                  seções acessíveis pelo menu horizontal superior.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.35fr_0.95fr]">
          <div className="rounded-[2rem] border border-border/70 bg-skin-surface p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-skin-text-muted">
              Como navegar
            </p>
            <div className="mt-4 space-y-4 text-sm leading-6 text-skin-text-muted">
              <p>
                As opções no topo ficam alinhadas lado a lado para acelerar o acesso entre telas sem abrir um
                novo painel dentro da página.
              </p>
              <p>
                O item ativo permanece destacado, e a barra horizontal pode ser rolada em telas menores sem
                alterar a estrutura real das configurações disponíveis.
              </p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-border/70 bg-skin-surface p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-skin-text-muted">
              Atalhos úteis
            </p>

            <div className="mt-4 flex flex-col gap-3">
              <Link
                href="/perfil"
                className="inline-flex items-center justify-between rounded-2xl border border-border/70 bg-skin-surface/70 px-4 py-3 text-sm font-semibold text-skin-text transition-colors hover:border-skin-primary/30 hover:text-skin-primary"
              >
                Ver perfil
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/dashboard"
                className="inline-flex items-center justify-between rounded-2xl border border-border/70 bg-skin-surface/70 px-4 py-3 text-sm font-semibold text-skin-text transition-colors hover:border-skin-primary/30 hover:text-skin-primary"
              >
                <span className="inline-flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  Voltar ao painel principal
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </ProtectedRoute>
  );
}
