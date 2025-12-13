"use client";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { ModuleManagement } from "./components/ModuleManagement";
import { Package } from "lucide-react";

export default function ModulosPage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Package className="h-8 w-8" />
            Gerenciamento de Módulos
          </h1>
          <p className="text-muted-foreground mt-2">
            Instale, remova e gerencie módulos do sistema globalmente
          </p>
        </div>

        <ModuleManagement />
      </div>
    </ProtectedRoute>
  );
}