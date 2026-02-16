import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { SecurityConfigProvider } from "@/contexts/SecurityConfigContext";
import { PlatformConfigProvider } from "@/contexts/PlatformConfigContext";
import { Toaster } from "@/components/ui/toaster";
import { AppLayout } from "@/components/AppLayout";
import { NotificationProvider } from "@/providers/NotificationProvider";
import { InactivityLogout } from "@/components/InactivityLogout";
import { ThemeProvider } from "@/providers/ThemeProvider";

export const metadata: Metadata = {
  title: "Sistema Multitenant", // Será atualizado dinamicamente pelo DynamicTitle
  description: "Sistema com isolamento de dados e controle de acesso",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
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
            <SecurityConfigProvider>
              <NotificationProvider>
                <ThemeProvider
                  attribute="class"
                  defaultTheme="light"
                  enableSystem
                  disableTransitionOnChange
                >
                  <InactivityLogout />
                  <AppLayout>
                    {children}
                  </AppLayout>
                  <Toaster />
                </ThemeProvider>
              </NotificationProvider>
            </SecurityConfigProvider>
          </AuthProvider>
        </PlatformConfigProvider>
      </body>
    </html>
  );
}
