"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { getConfigurationPanelItems } from "@/lib/configuration-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export default function ConfiguracoesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const desktopNavRef = useRef<HTMLDivElement>(null);

  const visibleItems = useMemo(
    () => getConfigurationPanelItems(user?.role),
    [user?.role],
  );

  const activeItem = visibleItems.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  useEffect(() => {
    const activeLink = desktopNavRef.current?.querySelector("[aria-current='page']");
    if (activeLink instanceof HTMLElement) {
      activeLink.scrollIntoView({
        inline: "center",
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [pathname]);

  const scrollDesktopMenu = (direction: "left" | "right") => {
    const container = desktopNavRef.current;
    if (!container) {
      return;
    }

    const amount = Math.max(220, Math.floor(container.clientWidth * 0.65));
    container.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <div className="min-h-full bg-skin-surface">
      <div className="flex min-h-full min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <div className="sticky top-0 z-30 border-b border-border bg-skin-surface/95 backdrop-blur supports-[backdrop-filter]:bg-skin-surface/90">
          <div className="px-3 py-2 md:px-6">
            <div className="md:hidden">
              <Select
                value={activeItem?.href}
                onValueChange={(value) => {
                  if (value && value !== pathname) {
                    router.push(value);
                  }
                }}
              >
                <SelectTrigger className="h-11 rounded-2xl border-border/80 bg-card text-sm font-semibold">
                  <SelectValue placeholder="Abrir secao de configuracoes" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[60vh]">
                  {visibleItems.map((item) => (
                    <SelectItem key={item.href} value={item.href}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => scrollDesktopMenu("left")}
                className="h-9 w-9 flex-shrink-0 rounded-full border border-border/80 bg-card"
                aria-label="Ver itens anteriores do menu de configuracoes"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <nav
                ref={desktopNavRef}
                className="no-scrollbar flex-1 overflow-x-auto scroll-smooth"
                aria-label="Secoes de configuracoes"
              >
                <div className="flex min-w-max items-center gap-2 pb-1">
                  <Link
                    href="/configuracoes"
                    aria-current={pathname === "/configuracoes" ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-10 items-center rounded-full border px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-all",
                      pathname === "/configuracoes"
                        ? "border-skin-primary bg-skin-primary text-skin-text-inverse shadow-md shadow-skin-primary/20"
                        : "border-border/80 bg-card text-skin-text-muted hover:border-skin-primary/20 hover:text-skin-text",
                    )}
                  >
                    Visao geral
                  </Link>

                  {visibleItems.map((item) => {
                    const isActive =
                      pathname === item.href || pathname.startsWith(`${item.href}/`);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "inline-flex min-h-10 items-center rounded-full border px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-all",
                          isActive
                            ? "border-skin-primary bg-skin-primary text-skin-text-inverse shadow-md shadow-skin-primary/20"
                            : "border-border/80 bg-card text-skin-text-muted hover:border-skin-primary/20 hover:text-skin-text",
                        )}
                      >
                        {item.name}
                      </Link>
                    );
                  })}
                </div>
              </nav>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => scrollDesktopMenu("right")}
                className="h-9 w-9 flex-shrink-0 rounded-full border border-border/80 bg-card"
                aria-label="Ver proximos itens do menu de configuracoes"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
