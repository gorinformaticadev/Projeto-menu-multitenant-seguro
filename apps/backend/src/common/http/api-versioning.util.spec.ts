import {
  API_CURRENT_VERSION,
  API_DEFAULT_VERSION,
  API_SUPPORTED_VERSIONS,
  API_VERSION_HEADER,
} from '@contracts/http';
import {
  buildApiVersionResponseHeaders,
  resolveApiVersion,
} from './api-versioning.util';

describe('api versioning', () => {
  it('keeps old clients working by defaulting missing headers to v1', () => {
    const resolution = resolveApiVersion(undefined);

    expect(resolution).toMatchObject({
      ok: true,
      requestedVersion: null,
      resolvedVersion: API_DEFAULT_VERSION,
      wasDefaulted: true,
      isDeprecated: true,
    });

    if (!resolution.ok) {
      throw new Error('Expected a supported resolution');
    }

    expect(buildApiVersionResponseHeaders(resolution)).toEqual(
      expect.objectContaining({
        [API_VERSION_HEADER]: API_DEFAULT_VERSION,
        'x-api-latest-version': API_CURRENT_VERSION,
        'x-api-supported-versions': API_SUPPORTED_VERSIONS.join(', '),
        'x-api-deprecated': 'true',
        Deprecation: 'true',
      }),
    );
  });

  it('accepts the current version explicitly without deprecation headers', () => {
    const resolution = resolveApiVersion(API_CURRENT_VERSION);

    expect(resolution).toMatchObject({
      ok: true,
      requestedVersion: API_CURRENT_VERSION,
      resolvedVersion: API_CURRENT_VERSION,
      wasDefaulted: false,
      isDeprecated: false,
    });

    if (!resolution.ok) {
      throw new Error('Expected a supported resolution');
    }

    expect(buildApiVersionResponseHeaders(resolution)).toEqual(
      expect.objectContaining({
        [API_VERSION_HEADER]: API_CURRENT_VERSION,
        'x-api-deprecated': 'false',
      }),
    );
    expect(buildApiVersionResponseHeaders(resolution).Deprecation).toBeUndefined();
  });

  it('rejects unsupported api versions instead of falling back silently', () => {
    expect(resolveApiVersion('99')).toEqual({
      ok: false,
      requestedVersion: '99',
      supportedVersions: API_SUPPORTED_VERSIONS,
      latestVersion: API_CURRENT_VERSION,
    });
  });

  it('defaults to the latest route-supported version when the global default is not available on that endpoint', () => {
    const resolution = resolveApiVersion(undefined, ['2']);

    expect(resolution).toMatchObject({
      ok: true,
      requestedVersion: null,
      resolvedVersion: '2',
      latestVersion: '2',
      supportedVersions: ['2'],
      wasDefaulted: true,
      isDeprecated: false,
    });
  });

  it('rejects an explicit version that the route does not support', () => {
    expect(resolveApiVersion('1', ['2'])).toEqual({
      ok: false,
      requestedVersion: '1',
      supportedVersions: ['2'],
      latestVersion: '2',
    });
  });
});
