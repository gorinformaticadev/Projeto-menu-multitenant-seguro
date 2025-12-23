"use client";

import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Building2 } from "lucide-react";
import PlatformConfigSection from "@/components/PlatformConfigSection";

export default function IdentidadePage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Building2 className="h-8 w-8" />
            Identidade da Plataforma
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure as informações básicas da plataforma que serão exibidas no sistema
          </p>
        </div>

        <PlatformConfigSection />
      </div>
    </ProtectedRoute>
  );
}