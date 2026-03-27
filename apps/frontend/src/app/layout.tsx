import type { Metadata } from "next";
import "./globals.css";
import "react-grid-layout/css/styles.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { SecurityConfigProvider } from "@/contexts/SecurityConfigContext";
import { PlatformConfigProvider } from "@/contexts/PlatformConfigContext";
import { Toaster } from "@/components/ui/toaster";
import { AppLayout } from "@/components/AppLayout";
import { NotificationProvider } from "@/providers/NotificationProvider";
import { InactivityLogout } from "@/components/InactivityLogout";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { MaintenanceProvider } from "@/contexts/MaintenanceContext";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import { SystemNotificationsProvider } from "@/contexts/SystemNotificationsContext";
import { APP_THEME_VALUES, PUBLIC_THEME_STORAGE_KEY } from "@/lib/app-theme";

/** Valor padrão usado como fallback quando o backend não está acessível no SSR */
const PLATFORM_NAME_FALLBACK = "Pluggor";

/**
 * Busca o nome da plataforma diretamente no backend durante o SSR.
 * Usa a URL interna do servidor (NEXT_PUBLIC_API_URL) para evitar
 * depender do rewrite do Next.js, que só funciona no browser.
 */
async function fetchPlatformNameSSR(): Promise<string> {
  try {
    const rawApiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");
    const apiBase = rawApiUrl.endsWith("/api") ? rawApiUrl : `${rawApiUrl}/api`;
    const res = await fetch(`${apiBase}/platform-config/name`, {
      // Revalidar a cada 60 segundos no cache do Next.js
      next: { revalidate: 60 },
    });
    if (!res.ok) return PLATFORM_NAME_FALLBACK;
    const data = (await res.json()) as { platformName?: unknown };
    const name = typeof data.platformName === "string" ? data.platformName.trim() : "";
    return name || PLATFORM_NAME_FALLBACK;
  } catch {
    return PLATFORM_NAME_FALLBACK;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const platformName = await fetchPlatformNameSSR();
  return {
    title: platformName,
    description: "Sistema com isolamento de dados e controle de acesso",
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: 'any' },
        { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
        { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
        { url: '/pwa.svg', type: 'image/svg+xml' },
      ],
      apple: '/apple-touch-icon.png',
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/pwa.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon-16x16.png" sizes="16x16" type="image/png" />
        <link rel="icon" href="/favicon-32x32.png" sizes="32x32" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className="font-sans"
        style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" }}
        suppressHydrationWarning
      >
        <PlatformConfigProvider>
          <AuthProvider>
            <MaintenanceProvider>
              <SecurityConfigProvider>
                <NotificationProvider>
                  <SystemNotificationsProvider>
                    <ThemeProvider
                      attribute="class"
                      defaultTheme="light"
                      enableSystem
                      disableTransitionOnChange
                      storageKey={PUBLIC_THEME_STORAGE_KEY}
                      themes={[...APP_THEME_VALUES]}
                    >
                      {/* Politica explicita:
                          - shell autenticado: ThemeProvider aplica somente a preferencia canonica do AuthContext
                          - shell nao autenticado: usa apenas esta configuracao publica do provider */}
                      <MaintenanceBanner />
                      <InactivityLogout />
                      <AppLayout>
                        {children}
                      </AppLayout>
                      <Toaster />
                    </ThemeProvider>
                  </SystemNotificationsProvider>
                </NotificationProvider>
              </SecurityConfigProvider>
            </MaintenanceProvider>
          </AuthProvider>
        </PlatformConfigProvider>
      </body>
    </html>
  );
}
