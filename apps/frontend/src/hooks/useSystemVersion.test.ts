import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSystemVersion } from '@/hooks/useSystemVersion';

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    get: vi.fn(),
  },
}));

vi.mock('@/lib/api', () => ({
  default: apiMock,
}));

describe('useSystemVersion', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
  });

  it('consome a versao instalada real e preserva a base tag quando o backend retorna git_describe', async () => {
    apiMock.get.mockResolvedValue({
      data: {
        version: 'v3.4.2+abc1234',
        source: 'git_describe',
        versionSource: 'git_describe',
        installedVersionRaw: 'v3.4.2+abc1234',
        installedBaseTag: 'v3.4.2',
        installedVersionNormalized: '3.4.2',
        isExactTaggedRelease: false,
        commitSha: 'abc1234',
      },
    });

    const { result } = renderHook(() => useSystemVersion());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.version).toBe('v3.4.2+abc1234');
    expect(result.current.source).toBe('git_describe');
    expect(result.current.versionInfo.installedBaseTag).toBe('v3.4.2');
    expect(result.current.versionInfo.installedVersionNormalized).toBe('3.4.2');
    expect(result.current.versionInfo.isExactTaggedRelease).toBe(false);
  });

  it('mantem fallback unknown quando a leitura da versao falha', async () => {
    apiMock.get.mockRejectedValue(new Error('falha'));

    const { result } = renderHook(() => useSystemVersion());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.version).toBe('unknown');
    expect(result.current.source).toBe('unknown');
    expect(result.current.versionInfo.installedBaseTag).toBeNull();
  });
});
