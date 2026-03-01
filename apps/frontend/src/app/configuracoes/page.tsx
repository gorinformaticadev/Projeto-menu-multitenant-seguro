"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  Shield,
  Building2,
  Package,
  Download,
  ChevronRight,
  Clock,
  LayoutDashboard,
  Cog
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ConfiguracoesPage() {
  const { user } = useAuth();

  const menuItems = [
    {
      name: "Segurança",
      href: "/configuracoes/seguranca",
      icon: Shield,
      description: "Políticas de segurança, autenticação e controle de acesso",
      show: user?.role === "SUPER_ADMIN",
      color: "bg-red-50 text-red-600 border-red-100",
      iconColor: "text-red-500"
    },
    {
      name: "Identidade da Plataforma",
      href: "/configuracoes/identidade",
      icon: Building2,
      description: "Logo, cores e informações básicas do sistema",
      show: user?.role === "SUPER_ADMIN",
      color: "bg-blue-50 text-blue-600 border-blue-100",
      iconColor: "text-blue-500"
    },
    {
      name: "Gerenciamento de Módulos",
      href: "/configuracoes/sistema/modulos",
      icon: Package,
      description: "Instalar, remover e gerenciar extensões",
      show: user?.role === "SUPER_ADMIN",
      color: "bg-amber-50 text-amber-600 border-amber-100",
      iconColor: "text-amber-500"
    },
    {
      name: "Sistema de Updates",
      href: "/configuracoes/sistema/updates",
      icon: Download,
      description: "Gerenciar atualizações automáticas via repositório",
      show: user?.role === "SUPER_ADMIN",
      color: "bg-green-50 text-green-600 border-green-100",
      iconColor: "text-green-500"
    },
    {
      name: "Agendamento de Tarefas",
      href: "/configuracoes/sistema/cron",
      icon: Clock,
      description: "Gerenciar jobs, backups e cronogramas",
      show: user?.role === "SUPER_ADMIN",
      color: "bg-indigo-50 text-indigo-600 border-indigo-100",
      iconColor: "text-indigo-500"
    },
    {
      name: "Configurações da Empresa",
      href: "/configuracoes/empresa",
      icon: Building2,
      description: "Informações cadastrais e faturamento",
      show: user?.role === "ADMIN",
      color: "bg-teal-50 text-teal-600 border-teal-100",
      iconColor: "text-teal-500"
    },
  ];

  const visibleItems = menuItems.filter(item => item.show);

  return (
    <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      <div className="p-4 md:p-8 max-w-4xl mx-auto pb-24">

        {/* Header Superior Limpo */}
        <div className="mb-10 text-center md:text-left">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/10 text-primary mb-4">
            <Cog className="h-8 w-8 animate-spin-slow" style={{ animationDuration: '8s' }} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto md:mx-0">
            Gerencie as preferências e permissões do seu ecossistema SaaS.
          </p>
        </div>

        {/* Hub de Opções Estilo Dashboard/Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex flex-col p-6 rounded-[2rem] border-2 bg-card transition-all hover:shadow-xl hover:-translate-y-1 active:scale-95",
                  "border-slate-100 hover:border-primary/20 shadow-sm"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110",
                  item.color
                )}>
                  <Icon className="h-6 w-6" />
                </div>

                <div className="flex-1">
                  <h3 className="text-lg font-bold flex items-center gap-2 group-hover:text-primary transition-colors">
                    {item.name}
                    <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* Badge de Acesso (Sutil) */}
                <div className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest text-slate-300 opacity-40">
                  SaaS Config
                </div>
              </Link>
            );
          })}
        </div>

        {/* Card de Informações de Conta (Rodapé do Conteúdo) */}
        <div className="mt-12 p-6 rounded-[2.5rem] bg-slate-50 border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 text-center md:text-left">
            <div className="w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center text-xl font-bold border border-slate-200">
              {user?.name?.charAt(0)}
            </div>
            <div>
              <h4 className="font-bold text-slate-800">{user?.name}</h4>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <span className="px-4 py-2 bg-white rounded-full text-xs font-bold border border-slate-200 shadow-sm">
              {user?.role} Access
            </span>
            <Link
              href="/perfil"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-xs font-bold shadow-md hover:brightness-110 active:scale-95 transition-all"
            >
              Ver Perfil
            </Link>
          </div>
        </div>

        {/* Atalho para Dashboard rápido */}
        <div className="mt-8 text-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
          >
            <LayoutDashboard className="h-3 w-3" />
            Voltar para o Painel Principal
          </Link>
        </div>

      </div>
    </ProtectedRoute>
  );
}
