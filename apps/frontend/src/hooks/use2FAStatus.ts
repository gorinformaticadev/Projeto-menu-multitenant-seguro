import { useState, useEffect } from 'react';
import { getTwoFactorStatus } from '@/lib/contracts/auth-client';
import api from '@/lib/api';

interface TwoFactorStatus {
  enabled: boolean;
  suggested: boolean;
}

export function use2FAStatus() {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetch2FAStatus = async () => {
      try {
        setLoading(true);
        const userStatus = await getTwoFactorStatus();
        setStatus(userStatus);
      } catch {
        try {
          const configResponse = await api.get('/security-config/2fa-status');
          setStatus({
            enabled: configResponse.data.enabled || false,
            suggested: true,
          });
        } catch {
          setError('Falha ao carregar status de 2FA');
          setStatus({
            enabled: false,
            suggested: true,
          });
        }
      } finally {
        setLoading(false);
      }
    };

    void fetch2FAStatus();
  }, []);

  return { status, loading, error };
}
