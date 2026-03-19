"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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

export default function ConfiguracoesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const layoutRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef(0);
  const lastToggleScrollTopRef = useRef(0);
  const [isTopMenuHidden, setIsTopMenuHidden] = useState(false);

  const visibleItems = getConfigurationPanelItems(user?.role);
  const activeItem = visibleItems.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  useEffect(() => {
    setIsTopMenuHidden(false);
    lastToggleScrollTopRef.current = 0;
  }, [pathname]);

  useEffect(() => {
    const scrollContainer = layoutRef.current?.closest("main");
    if (!(scrollContainer instanceof HTMLElement)) {
      return;
    }

    lastScrollTopRef.current = scrollContainer.scrollTop;
    lastToggleScrollTopRef.current = scrollContainer.scrollTop;
    let frameId = 0;

    const syncVisibility = () => {
      const currentScrollTop = scrollContainer.scrollTop;
      const previousScrollTop = lastScrollTopRef.current;
      const scrollingDown = currentScrollTop > previousScrollTop;
      const scrollingUp = currentScrollTop < previousScrollTop;
      const distanceSinceToggle = Math.abs(currentScrollTop - lastToggleScrollTopRef.current);

      if (currentScrollTop <= 12) {
        setIsTopMenuHidden(false);
        lastToggleScrollTopRef.current = currentScrollTop;
      } else if (!isTopMenuHidden && scrollingDown && distanceSinceToggle >= 96) {
        setIsTopMenuHidden(true);
        lastToggleScrollTopRef.current = currentScrollTop;
      } else if (isTopMenuHidden && scrollingUp && distanceSinceToggle >= 64) {
        setIsTopMenuHidden(false);
        lastToggleScrollTopRef.current = currentScrollTop;
      }

      lastScrollTopRef.current = currentScrollTop;
      frameId = 0;
    };

    const handleScroll = () => {
      if (frameId) {
        return;
      }

      frameId = window.requestAnimationFrame(syncVisibility);
    };

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      scrollContainer.removeEventListener("scroll", handleScroll);
    };
  }, [isTopMenuHidden]);

  return (
    <div ref={layoutRef} className="min-h-full bg-skin-surface">
      <div className="flex min-h-full min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <div
          className={cn(
            "sticky top-0 z-30 overflow-hidden bg-skin-surface/95 backdrop-blur supports-[backdrop-filter]:bg-skin-surface/85",
            "transition-[max-height,opacity,transform,border-color] duration-200 ease-out",
            isTopMenuHidden
              ? "max-h-0 -translate-y-2 border-b border-transparent opacity-0 pointer-events-none"
              : "max-h-24 translate-y-0 border-b border-border opacity-100",
          )}
        >
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
                  <SelectValue placeholder="Abrir seção de configurações" />
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

            <nav className="no-scrollbar hidden overflow-x-auto md:block">
              <div className="flex min-w-max items-center gap-2 pb-1">
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
          </div>
        </div>

        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
