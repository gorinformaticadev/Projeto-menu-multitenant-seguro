import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook para logout automático por inatividade
 * @param timeoutMinutes - Tempo de inatividade em minutos antes de deslogar
 */
export function useInactivityLogout(timeoutMinutes: number = 30) {
  const { logout, user } = useAuth();
  const { toast, dismiss } = useToast();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningToastIdRef = useRef<string | null>(null);

  const dismissWarningToast = useCallback(() => {
    if (!warningToastIdRef.current) {
      return;
    }
    dismiss(warningToastIdRef.current);
    warningToastIdRef.current = null;
  }, [dismiss]);

  const resetTimer = useCallback(() => {
    // Limpar timers existentes
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }
    dismissWarningToast();

    // Não iniciar timer se não houver usuário logado
    if (!user) return;

    const parsedTimeoutMinutes = Number(timeoutMinutes);
    const normalizedTimeoutMinutes =
      Number.isFinite(parsedTimeoutMinutes) && parsedTimeoutMinutes > 0
        ? parsedTimeoutMinutes
        : 30;
    const timeoutMs = normalizedTimeoutMinutes * 60 * 1000;
    const warningLeadMs = Math.min(60 * 1000, timeoutMs / 2);
    const warningMs = timeoutMs - warningLeadMs;

    // Timer de aviso (até 1 minuto antes do logout, sem disparo imediato em timeout curto)
    if (warningMs > 0 && warningLeadMs >= 1000) {
      warningTimeoutRef.current = setTimeout(() => {
        const warning = toast({
          title: "Sessão expirando",
          description: "Você será deslogado em 1 minuto por inatividade. Mova o mouse ou pressione uma tecla para continuar.",
          variant: "default",
        });
        warningToastIdRef.current = warning.id;
      }, warningMs);
    }

    // Timer de logout
    timeoutRef.current = setTimeout(() => {
      dismissWarningToast();
      toast({
        title: "Sessão expirada",
        description: "Você foi deslogado por inatividade.",
        variant: "destructive",
      });
      logout();
    }, timeoutMs);
  }, [timeoutMinutes, user, logout, toast, dismissWarningToast]);

  useEffect(() => {
    // Eventos que resetam o timer
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    // Adicionar listeners
    events.forEach((event) => {
      document.addEventListener(event, resetTimer);
    });

    // Iniciar timer
    resetTimer();

    // Cleanup
    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, resetTimer);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
      dismissWarningToast();
    };
  }, [resetTimer, dismissWarningToast]);
}
