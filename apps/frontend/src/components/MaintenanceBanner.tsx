"use client";

import Link from 'next/link';
import { AlertTriangle, Wrench } from 'lucide-react';
import { useMaintenance } from '@/contexts/MaintenanceContext';

function formatEta(etaSeconds: number | null): string {
  if (!etaSeconds || etaSeconds <= 0) {
    return 'alguns minutos';
  }

  const minutes = Math.max(1, Math.ceil(etaSeconds / 60));
  return `${minutes} min`;
}

export function MaintenanceBanner() {
  const { state, isMaintenanceActive, isSuperAdmin } = useMaintenance();

  if (!isMaintenanceActive) {
    return null;
  }

  return (
    <div className="sticky top-0 z-[120] border-b border-skin-warning/30 bg-skin-warning/10 text-skin-warning">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 px-4 py-2 text-sm">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-semibold">Sistema em manutencao</span>
          <span className="hidden sm:inline">- {state.reason || 'Atualizacao em andamento'}</span>
          <span className="hidden md:inline">(ETA: {formatEta(state.etaSeconds)})</span>
        </div>

        {isSuperAdmin && (
          <Link
            href="/configuracoes/sistema/updates"
            className="inline-flex items-center gap-1 rounded border border-skin-warning/40 bg-skin-warning/15 px-2 py-1 text-xs font-semibold text-skin-warning transition-colors hover:bg-skin-warning/20"
          >
            <Wrench className="h-3.5 w-3.5" />
            Monitorar update
          </Link>
        )}
      </div>
    </div>
  );
}
