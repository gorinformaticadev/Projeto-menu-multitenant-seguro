import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

type VersionSource = 'env' | 'file' | 'build_info' | 'unknown';

interface VersionResponse {
  version?: string;
  source?: string;
  commitSha?: string;
  buildDate?: string;
  branch?: string;
}

export interface SystemVersionInfo {
  version: string;
  source: VersionSource;
  commitSha?: string;
  buildDate?: string;
  branch?: string;
}

const FALLBACK_VERSION: SystemVersionInfo = {
  version: 'unknown',
  source: 'unknown',
};

function normalizeVersionResponse(payload: VersionResponse | null | undefined): SystemVersionInfo {
  const rawSource = String(payload?.source || '').trim();
  const source: VersionSource =
    rawSource === 'env' || rawSource === 'file' || rawSource === 'build_info' || rawSource === 'unknown'
      ? rawSource
      : 'unknown';

  const version = String(payload?.version || '').trim() || 'unknown';
  const commitSha = String(payload?.commitSha || '').trim() || undefined;
  const buildDate = String(payload?.buildDate || '').trim() || undefined;
  const branch = String(payload?.branch || '').trim() || undefined;

  return { version, source, commitSha, buildDate, branch };
}

export function useSystemVersion() {
  const [versionInfo, setVersionInfo] = useState<SystemVersionInfo>(FALLBACK_VERSION);
  const [loading, setLoading] = useState(true);

  const fetchVersion = useCallback(async () => {
    setLoading(true);

    try {
      const response = await api.get('/api/system/version');
      setVersionInfo(normalizeVersionResponse(response.data));
    } catch {
      setVersionInfo(FALLBACK_VERSION);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchVersion();
  }, [fetchVersion]);

  return {
    version: versionInfo.version,
    source: versionInfo.source,
    versionInfo,
    loading,
    refreshVersion: fetchVersion,
  };
}
