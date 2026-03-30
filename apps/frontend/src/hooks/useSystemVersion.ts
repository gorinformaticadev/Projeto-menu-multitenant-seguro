import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

type VersionSource =
  | 'git_exact_tag'
  | 'git_describe'
  | 'git_base_tag'
  | 'env'
  | 'file'
  | 'build_info'
  | 'package_json'
  | 'unknown';

interface VersionResponse {
  version?: string;
  source?: string;
  versionSource?: string;
  installedVersionRaw?: string;
  installedBaseTag?: string | null;
  installedVersionNormalized?: string | null;
  isExactTaggedRelease?: boolean;
  commitSha?: string;
  buildDate?: string;
  branch?: string;
}

export interface SystemVersionInfo {
  version: string;
  source: VersionSource;
  versionSource: VersionSource;
  installedVersionRaw: string;
  installedBaseTag: string | null;
  installedVersionNormalized: string | null;
  isExactTaggedRelease: boolean;
  commitSha?: string;
  buildDate?: string;
  branch?: string;
}

const FALLBACK_VERSION: SystemVersionInfo = {
  version: 'unknown',
  source: 'unknown',
  versionSource: 'unknown',
  installedVersionRaw: 'unknown',
  installedBaseTag: null,
  installedVersionNormalized: null,
  isExactTaggedRelease: false,
};

function normalizeVersionSource(rawSource: string): VersionSource {
  return rawSource === 'git_exact_tag' ||
    rawSource === 'git_describe' ||
    rawSource === 'git_base_tag' ||
    rawSource === 'env' ||
    rawSource === 'file' ||
    rawSource === 'build_info' ||
    rawSource === 'package_json' ||
    rawSource === 'unknown'
    ? rawSource
    : 'unknown';
}

function normalizeVersionResponse(payload: VersionResponse | null | undefined): SystemVersionInfo {
  const rawSource = String(payload?.versionSource || payload?.source || '').trim();
  const source = normalizeVersionSource(rawSource);
  const installedVersionRaw =
    String(payload?.installedVersionRaw || payload?.version || '').trim() || 'unknown';
  const installedBaseTag = String(payload?.installedBaseTag || '').trim() || null;
  const installedVersionNormalized = String(payload?.installedVersionNormalized || '').trim() || null;
  const commitSha = String(payload?.commitSha || '').trim() || undefined;
  const buildDate = String(payload?.buildDate || '').trim() || undefined;
  const branch = String(payload?.branch || '').trim() || undefined;

  return {
    version: installedVersionRaw,
    source,
    versionSource: source,
    installedVersionRaw,
    installedBaseTag,
    installedVersionNormalized,
    isExactTaggedRelease: Boolean(payload?.isExactTaggedRelease),
    commitSha,
    buildDate,
    branch,
  };
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
