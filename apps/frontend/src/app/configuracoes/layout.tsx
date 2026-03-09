"use client";

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

  const visibleItems = getConfigurationPanelItems(user?.role);
  const activeItem = visibleItems.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return (
    <div className="min-h-full bg-background">
      <div className="flex min-h-full min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
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
                          ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
                          : "border-border/80 bg-card text-muted-foreground hover:border-primary/20 hover:text-foreground",
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
