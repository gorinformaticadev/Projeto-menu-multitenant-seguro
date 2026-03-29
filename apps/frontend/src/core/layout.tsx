import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { SecurityConfigProvider } from "@/contexts/SecurityConfigContext";
import { PlatformConfigProvider } from "@/contexts/PlatformConfigContext";
import { Toaster } from "@/components/ui/toaster";
import { AppLayout } from "@/components/AppLayout";
import { InactivityLogout } from "@/components/InactivityLogout";

const inter = Inter({ subsets: ["latin"] });

// Nota: este arquivo é legado. O layout canônico é apps/frontend/src/app/layout.tsx.
// O título é resolvido dinamicamente via generateMetadata() no layout principal.
export const metadata: Metadata = {
  title: "Pluggor",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <PlatformConfigProvider>
          <AuthProvider>
            <SecurityConfigProvider>
              <InactivityLogout />
              <AppLayout>
                {children}
              </AppLayout>
              <Toaster />
            </SecurityConfigProvider>
          </AuthProvider>
        </PlatformConfigProvider>
      </body>
    </html>
  );
}
