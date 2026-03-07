"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Home, Building2, Users, LayoutGrid, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { moduleRegistry } from "@/lib/module-registry";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);

  // Obtém módulos ativos para o launcher
  const taskbarItems = moduleRegistry.getTaskbarItems(user?.role);

  const leftItems = [
    { label: "Home", href: "/dashboard", icon: Home },
    { label: "Empresas", href: "/empresas", icon: Building2, adminOnly: true },
  ].filter(item => !item.adminOnly || user?.role === "ADMIN" || user?.role === "SUPER_ADMIN");

  const rightItems = [
    { label: "Usuários", href: "/usuarios", icon: Users, adminOnly: true },
    { label: "Config", href: "/configuracoes", icon: MoreHorizontal },
  ].filter(item => !item.adminOnly || user?.role === "ADMIN" || user?.role === "SUPER_ADMIN");

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-between border-t border-border/80 bg-card/95 px-2 shadow-[0_-6px_18px_rgba(15,23,42,0.06)] backdrop-blur-lg pb-safe md:hidden supports-[backdrop-filter]:bg-card/88">

        {/* Esquerda: Home, Empresas */}
        <div className="flex flex-1 justify-around">
          {leftItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 transition-all active:scale-95",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon size={20} className={isActive ? "fill-primary/10" : ""} />
                <span className="text-[10px] font-bold">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Centro: Módulos do Sistema */}
        <div className="flex-shrink-0 px-2">
          <button
            onClick={() => setIsLauncherOpen(true)}
            className="flex h-14 w-14 -translate-y-5 flex-col items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_12px_26px_rgba(37,99,235,0.24)] ring-4 ring-background transition-all hover:brightness-110 active:scale-90"
            aria-label="Launcher de Módulos"
          >
            <Image
              src="/menu.svg"
              alt="Logo"
              width={32}
              height={32}
              className="w-8 h-8 object-contain"
              onError={(e) => {
                e.currentTarget.src = '/favicon-32x32.png';
              }}
            />
          </button>
        </div>

        {/* Direita: Usuários, Config */}
        <div className="flex flex-1 justify-around">
          {rightItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 transition-all active:scale-95",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon size={20} className={isActive ? "fill-primary/10" : ""} />
                <span className="text-[10px] font-bold">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* App Launcher Modal */}
      <Dialog open={isLauncherOpen} onOpenChange={setIsLauncherOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-t-[32px] sm:rounded-lg overflow-hidden border-none pb-12">
          <DialogHeader className="pt-4">
            <DialogTitle className="text-center text-xl font-bold">Módulos do Sistema</DialogTitle>
            <p className="text-center text-xs text-muted-foreground">Acesse suas ferramentas modulares</p>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-y-8 gap-x-4 py-8 max-h-[60vh] overflow-y-auto no-scrollbar">
            {taskbarItems.length > 0 ? (
              taskbarItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setIsLauncherOpen(false)}
                  className="flex flex-col items-center gap-2 group transition-all active:scale-95"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border/70 bg-secondary text-primary shadow-sm transition-all duration-300 group-hover:border-primary/20 group-hover:bg-primary group-hover:text-primary-foreground">
                    <LayoutGrid size={32} />
                  </div>
                  <span className="text-[11px] font-bold text-center truncate w-full px-1">
                    {item.name}
                  </span>
                </Link>
              ))
            ) : (
              <div className="col-span-3 py-10 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                <LayoutGrid className="opacity-20" size={48} />
                <p>Nenhum módulo modular carregado.</p>
              </div>
            )}
          </div>
          <div className="px-4">
            <Button
              variant="outline"
              className="w-full rounded-xl py-6 font-bold"
              onClick={() => setIsLauncherOpen(false)}
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
