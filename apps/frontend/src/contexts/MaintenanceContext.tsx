"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type MaintenanceState = {
  enabled: boolean;
  reason: string | null;
  startedAt: string | null;
  etaSeconds: number | null;
  allowedRoles: string[];
  bypassHeader: string;
};

type MaintenanceContextData = {
  state: MaintenanceState;
  loading: boolean;
  refresh: () => Promise<void>;
  isMaintenanceActive: boolean;
  isSuperAdmin: boolean;
};

const STORAGE_KEY = '__maintenance_state';
const EVENT_ACTIVE = 'maintenance-mode';
const EVENT_CLEAR = 'maintenance-clear';

const DEFAULT_STATE: MaintenanceState = {
  enabled: false,
  reason: null,
  startedAt: null,
  etaSeconds: null,
  allowedRoles: ['SUPER_ADMIN'],
  bypassHeader: 'X-Maintenance-Bypass',
};

const MaintenanceContext = createContext<MaintenanceContextData>({} as MaintenanceContextData);

function normalizeState(input: Partial<MaintenanceState> | null | undefined): MaintenanceState {
  if (!input) {
    return { ...DEFAULT_STATE };
  }

  const allowedRoles = Array.isArray(input.allowedRoles)
    ? input.allowedRoles.map((role) => String(role || '').trim().toUpperCase()).filter(Boolean)
    : DEFAULT_STATE.allowedRoles;

  return {
    enabled: Boolean(input.enabled),
    reason: input.reason ? String(input.reason) : null,
    startedAt: input.startedAt ? String(input.startedAt) : null,
    etaSeconds: Number.isFinite(Number(input.etaSeconds)) ? Number(input.etaSeconds) : null,
    allowedRoles: allowedRoles.length > 0 ? allowedRoles : DEFAULT_STATE.allowedRoles,
    bypassHeader: input.bypassHeader ? String(input.bypassHeader) : DEFAULT_STATE.bypassHeader,
  };
}

function readStoredState(): MaintenanceState {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_STATE };
  }

  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { ...DEFAULT_STATE };
  }

  try {
    return normalizeState(JSON.parse(raw) as Partial<MaintenanceState>);
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function storeState(state: MaintenanceState): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clearStoredState(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.removeItem(STORAGE_KEY);
}

export function MaintenanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<MaintenanceState>(() => readStoredState());
  const [loading, setLoading] = useState(false);

  const applyState = useCallback((nextState: MaintenanceState) => {
    setState(nextState);
    if (nextState.enabled) {
      storeState(nextState);
    } else {
      clearStoredState();
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/system/maintenance/state', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as { data?: Partial<MaintenanceState> };
      const normalized = normalizeState(payload?.data);
      applyState(normalized);
    } catch {
      // Keep last known state; maintenance endpoint must stay lightweight and resilient.
    } finally {
      setLoading(false);
    }
  }, [applyState]);

  useEffect(() => {
    const onActive = (event: Event) => {
      const customEvent = event as CustomEvent<Partial<MaintenanceState>>;
      applyState(normalizeState(customEvent.detail));
    };

    const onClear = () => {
      applyState({ ...DEFAULT_STATE });
    };

    window.addEventListener(EVENT_ACTIVE, onActive as EventListener);
    window.addEventListener(EVENT_CLEAR, onClear as EventListener);

    return () => {
      window.removeEventListener(EVENT_ACTIVE, onActive as EventListener);
      window.removeEventListener(EVENT_CLEAR, onClear as EventListener);
    };
  }, [applyState]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 15000);

    return () => {
      window.clearInterval(interval);
    };
  }, [refresh]);

  const value = useMemo<MaintenanceContextData>(() => {
    const role = String(user?.role || '').toUpperCase();
    return {
      state,
      loading,
      refresh,
      isMaintenanceActive: state.enabled,
      isSuperAdmin: role === 'SUPER_ADMIN',
    };
  }, [loading, refresh, state, user?.role]);

  return <MaintenanceContext.Provider value={value}>{children}</MaintenanceContext.Provider>;
}

export function useMaintenance() {
  const context = useContext(MaintenanceContext);
  if (!context) {
    throw new Error('useMaintenance deve ser usado dentro de MaintenanceProvider');
  }
  return context;
}
