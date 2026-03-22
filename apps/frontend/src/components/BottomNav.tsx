"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AlertTriangle, LayoutGrid } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  EMPTY_NAVIGATION_MODEL,
  type NavigationModelResolution,
  moduleRegistry,
} from "@/lib/module-registry";
import { resolveNavigationIcon } from "@/lib/navigation-icons";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);
  const [navigationState, setNavigationState] = useState<NavigationModelResolution>({
    status: "ready",
    model: EMPTY_NAVIGATION_MODEL,
    error: null,
  });

  const loadNavigation = useCallback(() => {
    setNavigationState(moduleRegistry.resolveNavigationModel(user?.role));
  }, [user?.role]);

  useEffect(() => {
    loadNavigation();
  }, [loadNavigation]);

  useEffect(() => {
    const handleModuleStatusChanged = () => {
      loadNavigation();
    };

    window.addEventListener("moduleStatusChanged", handleModuleStatusChanged);
    return () => {
      window.removeEventListener("moduleStatusChanged", handleModuleStatusChanged);
    };
  }, [loadNavigation]);

  const navigationModel = navigationState.model;
  const mobileItems = navigationModel.mobileItems;
  const launcherItems = navigationModel.launcherItems;
  const leftItems = mobileItems.slice(0, 2);
  const rightItems = mobileItems.slice(2, 4);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-between border-t border-skin-border/80 bg-skin-surface/95 px-2 shadow-lg backdrop-blur-lg pb-safe md:hidden supports-[backdrop-filter]:bg-skin-surface/88">
        {navigationState.status === "error" && navigationState.error ? (
          <div
            role="alert"
            className="flex w-full items-center justify-center gap-2 px-4 text-center text-xs font-medium text-skin-danger"
          >
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{navigationState.error.message}</span>
          </div>
        ) : (
          <>
            <div className="flex flex-1 justify-around">
              {leftItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = resolveNavigationIcon(item.icon);

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={cn(
                      "flex flex-col items-center gap-1 transition-all active:scale-95",
                      isActive ? "text-skin-primary" : "text-skin-text-muted hover:text-skin-text",
                    )}
                  >
                    <Icon size={20} />
                    <span className="text-[10px] font-bold">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <div className="flex-shrink-0 px-2">
              <button
                onClick={() => setIsLauncherOpen(true)}
                className="flex h-14 w-14 -translate-y-5 flex-col items-center justify-center rounded-2xl bg-skin-primary text-skin-text-inverse shadow-lg ring-4 ring-skin-surface transition-all hover:brightness-110 active:scale-90"
                aria-label="Launcher de modulos"
              >
                <Image
                  src="/menu.svg"
                  alt="Abrir launcher de modulos"
                  width={32}
                  height={32}
                  className="h-8 w-8 object-contain"
                  onError={(event) => {
                    event.currentTarget.src = "/favicon-32x32.png";
                  }}
                />
              </button>
            </div>

            <div className="flex flex-1 justify-around">
              {rightItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = resolveNavigationIcon(item.icon);

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={cn(
                      "flex flex-col items-center gap-1 transition-all active:scale-95",
                      isActive ? "text-skin-primary" : "text-skin-text-muted hover:text-skin-text",
                    )}
                  >
                    <Icon size={20} />
                    <span className="text-[10px] font-bold">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </nav>

      <Dialog open={isLauncherOpen} onOpenChange={setIsLauncherOpen}>
        <DialogContent className="overflow-hidden rounded-t-[32px] border-none pb-12 sm:max-w-[425px] sm:rounded-lg">
          <DialogHeader className="pt-4">
            <DialogTitle className="text-center text-xl font-bold">Modulos do Sistema</DialogTitle>
            <p className="text-center text-xs text-skin-text-muted">
              Acesse suas ferramentas modulares
            </p>
          </DialogHeader>
          {navigationState.status === "error" && navigationState.error ? (
            <div
              role="alert"
              className="mx-1 my-6 rounded-2xl border border-skin-danger/20 bg-skin-danger/10 p-4 text-sm text-skin-danger"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Navegacao indisponivel</p>
                  <p className="mt-1 leading-relaxed">{navigationState.error.message}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="no-scrollbar grid max-h-[60vh] grid-cols-3 gap-x-4 gap-y-8 overflow-y-auto py-8">
              {launcherItems.length > 0 ? (
                launcherItems.map((item) => {
                  const Icon = resolveNavigationIcon(item.icon);

                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setIsLauncherOpen(false)}
                      className="group flex flex-col items-center gap-2 transition-all active:scale-95"
                    >
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-skin-border/70 bg-skin-secondary text-skin-primary shadow-sm transition-all duration-300 group-hover:border-skin-primary/20 group-hover:bg-skin-primary group-hover:text-skin-text-inverse">
                        <Icon size={32} />
                      </div>
                      <span className="w-full truncate px-1 text-center text-[11px] font-bold">
                        {item.name}
                      </span>
                    </Link>
                  );
                })
              ) : (
                <div className="col-span-3 flex flex-col items-center gap-2 py-10 text-center text-sm text-skin-text-muted">
                  <LayoutGrid className="opacity-20" size={48} />
                  <p>Nenhum modulo modular carregado.</p>
                </div>
              )}
            </div>
          )}
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
