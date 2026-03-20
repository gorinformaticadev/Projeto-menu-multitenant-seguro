import {
  buildRedisHealthSnapshot,
  classifyRedisHealthDetail,
  resolveRedisTopologyConfig,
} from './redis-topology.util';

describe('redis-topology util', () => {
  it('treats an explicit sentinel configuration without sentinels as invalid instead of silently disabled', () => {
    const config = resolveRedisTopologyConfig({
      REDIS_MODE: 'sentinel',
      REDIS_ENABLED: 'true',
      REDIS_MASTER_NAME: 'mymaster',
      REDIS_SENTINELS: '',
    } as NodeJS.ProcessEnv);

    expect(config).toMatchObject({
      mode: 'sentinel',
      enabled: true,
      valid: false,
      configured: true,
      invalidReason: 'redis-sentinels-missing',
    });
  });

  it('classifies runtime redis failures into operationally useful details', () => {
    const clusterConfig = resolveRedisTopologyConfig({
      REDIS_MODE: 'cluster',
      REDIS_ENABLED: 'true',
      REDIS_CLUSTER_NODES: '10.0.0.1:6379',
    } as NodeJS.ProcessEnv);

    expect(
      classifyRedisHealthDetail(clusterConfig, 'ClusterAllFailedError: Failed to refresh slots cache'),
    ).toBe('redis-cluster-partial-unavailable');
    expect(classifyRedisHealthDetail(clusterConfig, 'connect ETIMEDOUT 10.0.0.1:6379')).toBe(
      'redis-timeout',
    );
  });

  it('surfaces invalid topology reasons in the health snapshot', () => {
    const config = resolveRedisTopologyConfig({
      REDIS_MODE: 'standalone',
      REDIS_ENABLED: 'true',
      REDIS_HOST: '',
    } as NodeJS.ProcessEnv);

    const snapshot = buildRedisHealthSnapshot({
      config,
      client: undefined,
      fallbackActive: true,
      detail: null,
    });

    expect(snapshot).toMatchObject({
      enabled: true,
      valid: false,
      fallbackActive: true,
      detail: 'redis-standalone-host-missing',
    });
  });
});
