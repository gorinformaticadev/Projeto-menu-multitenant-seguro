# Distributed Runtime Proof

Gerado em: 2026-03-20T17:31:49.871Z

## Ambiente

- Instancias backend: backend-a (http://127.0.0.1:4101), backend-b (http://127.0.0.1:4102)
- Redis: Docker + Toxiproxy
- Postgres: Docker
- Dependency stub: host local em 127.0.0.1:4600
- Tenant A: d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2
- Tenant B: 298bc3b7-e571-41ea-bd4b-bbba0c37f782

## fairness-global

- Titulo: Fairness global por tenant
- Duracao: 1259 ms
- Esperado: Tenant B deve receber grants antes de Tenant A consumir toda a fila.
- Observado:
```json
{
  "tenantA": {
    "count": 6,
    "avgDurationMs": 567.83,
    "avgQueueWaitMs": 618.75,
    "maxQueueWaitMs": 1130,
    "rejected": 2
  },
  "tenantB": {
    "count": 3,
    "avgDurationMs": 741.67,
    "avgQueueWaitMs": 624,
    "maxQueueWaitMs": 948,
    "rejected": 0
  },
  "orderedStarts": [
    {
      "label": "tenant-a-1",
      "startedAt": "2026-03-20T17:31:00.449Z",
      "tenantId": "d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2",
      "instanceId": "backend-a"
    },
    {
      "label": "tenant-b-2",
      "startedAt": "2026-03-20T17:31:00.684Z",
      "tenantId": "298bc3b7-e571-41ea-bd4b-bbba0c37f782",
      "instanceId": "backend-a"
    },
    {
      "label": "tenant-a-3",
      "startedAt": "2026-03-20T17:31:00.890Z",
      "tenantId": "d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2",
      "instanceId": "backend-a"
    },
    {
      "label": "tenant-b-3",
      "startedAt": "2026-03-20T17:31:01.027Z",
      "tenantId": "298bc3b7-e571-41ea-bd4b-bbba0c37f782",
      "instanceId": "backend-b"
    },
    {
      "label": "tenant-a-5",
      "startedAt": "2026-03-20T17:31:01.175Z",
      "tenantId": "d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2",
      "instanceId": "backend-a"
    },
    {
      "label": "tenant-b-1",
      "startedAt": "2026-03-20T17:31:01.341Z",
      "tenantId": "298bc3b7-e571-41ea-bd4b-bbba0c37f782",
      "instanceId": "backend-b"
    },
    {
      "label": "tenant-a-4",
      "startedAt": "2026-03-20T17:31:01.521Z",
      "tenantId": "d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2",
      "instanceId": "backend-b"
    }
  ],
  "tenantBStartedBeforeTenantAExhaustedQueue": true,
  "midFlightQueue": {
    "backendA": {
      "routePolicyId": "ops-runtime-test-fair-queue",
      "active": 1,
      "queued": 5,
      "maxConcurrentRequests": 1,
      "maxConcurrentPerPartition": 1,
      "maxQueueDepth": 6,
      "maxQueueDepthPerPartition": 3,
      "partitions": [
        {
          "partitionKey": "tenant:d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2",
          "tenantId": "d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2",
          "userId": "010177ba-8e02-420c-91a3-e6603f953767",
          "clientIp": "127.0.0.1",
          "active": 0,
          "queued": 3,
          "grantedCount": 1,
          "lastGrantedAt": "2026-03-20T17:31:00.440Z"
        },
        {
          "partitionKey": "tenant:298bc3b7-e571-41ea-bd4b-bbba0c37f782",
          "tenantId": "298bc3b7-e571-41ea-bd4b-bbba0c37f782",
          "userId": "e445191f-9a2c-47b2-a022-fa35745b6088",
          "clientIp": "127.0.0.1",
          "active": 1,
          "queued": 2,
          "grantedCount": 1,
          "lastGrantedAt": "2026-03-20T17:31:00.680Z"
        }
      ]
    },
    "backendB": {
      "routePolicyId": "ops-runtime-test-fair-queue",
      "active": 0,
      "queued": 5,
      "maxConcurrentRequests": 1,
      "maxConcurrentPerPartition": 1,
      "maxQueueDepth": 6,
      "maxQueueDepthPerPartition": 3,
      "partitions": [
        {
          "partitionKey": "tenant:d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2",
          "tenantId": "d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2",
          "userId": "010177ba-8e02-420c-91a3-e6603f953767",
          "clientIp": "127.0.0.1",
          "active": 0,
          "queued": 3,
          "grantedCount": 1,
          "lastGrantedAt": "2026-03-20T17:31:00.440Z"
        },
        {
          "partitionKey": "tenant:298bc3b7-e571-41ea-bd4b-bbba0c37f782",
          "tenantId": "298bc3b7-e571-41ea-bd4b-bbba0c37f782",
          "userId": "e445191f-9a2c-47b2-a022-fa35745b6088",
          "clientIp": "127.0.0.1",
          "active": 0,
          "queued": 2,
          "grantedCount": 1,
          "lastGrantedAt": "2026-03-20T17:31:00.680Z"
        }
      ]
    }
  }
}
```

## redis-unavailable

- Titulo: Redis indisponivel em trafego real
- Duracao: 9322 ms
- Esperado: Cluster deve entrar em modo degradado explicito, expor fallbackActive/detail e nao fingir coordenacao global.
- Observado:
```json
{
  "backendA": {
    "distributedState": {
      "enabled": true,
      "valid": true,
      "configured": true,
      "mode": "standalone",
      "ready": false,
      "fallbackActive": true,
      "required": false,
      "fallbackMode": "memory",
      "status": "connect",
      "detail": "Stream isn't writeable and enableOfflineQueue options is false"
    },
    "lock": {
      "enabled": true,
      "valid": true,
      "configured": true,
      "mode": "standalone",
      "ready": false,
      "fallbackActive": true,
      "required": false,
      "fallbackMode": "memory",
      "status": "connect",
      "detail": "Stream isn't writeable and enableOfflineQueue options is false"
    }
  },
  "backendB": {
    "distributedState": {
      "enabled": true,
      "valid": true,
      "configured": true,
      "mode": "standalone",
      "ready": false,
      "fallbackActive": true,
      "required": false,
      "fallbackMode": "memory",
      "status": "connect",
      "detail": "Stream isn't writeable and enableOfflineQueue options is false"
    },
    "lock": {
      "enabled": true,
      "valid": true,
      "configured": true,
      "mode": "standalone",
      "ready": false,
      "fallbackActive": true,
      "required": false,
      "fallbackMode": "memory",
      "status": "connect",
      "detail": "Stream isn't writeable and enableOfflineQueue options is false"
    }
  },
  "dashboardRedis": {
    "status": "degraded",
    "error": "Dependencia Redis mitigada automaticamente sob pressao distribuida."
  },
  "alerts": {
    "instanceId": "backend-a",
    "emitted": [],
    "skipped": [
      "OPS_HIGH_5XX_ERROR_RATE",
      "OPS_CRITICAL_SLOW_ROUTE",
      "OPS_ACCESS_DENIED_SPIKE",
      "OPS_JOB_FAILURE_STORM",
      "OPS_VERSION_FALLBACK_SPIKE",
      "OPS_REQUEST_RETRY_STORM",
      "OPS_RUNTIME_PRESSURE_RECENT",
      "OPS_QUEUE_SATURATION",
      "OPS_CIRCUIT_BREAKER_INSTABILITY",
      "OPS_CORRELATED_OPERATIONAL_DEGRADATION",
      "OPS_DATABASE_DEGRADED",
      "OPS_REDIS_DEGRADED",
      "OPS_FEATURE_MITIGATION_ACTIVE"
    ]
  },
  "sameTenantRequests": [
    {
      "label": "tenant-a-down-a",
      "baseUrl": "http://127.0.0.1:4101",
      "routePath": "/api/ops-runtime-test/fair-queue/hold?holdMs=1200",
      "sentAt": "2026-03-20T17:31:05.698Z",
      "completedAt": "2026-03-20T17:31:05.830Z",
      "durationMs": 132,
      "queueWaitMs": 26,
      "status": 201,
      "ok": true,
      "headers": {
        "access-control-allow-credentials": "true",
        "access-control-expose-headers": "Content-Type,Content-Length,Content-Encoding,X-Request-Id,X-Trace-Id,Traceparent,Baggage,X-Total-Count,X-API-Version,X-API-Latest-Version,X-API-Supported-Versions,X-API-Deprecated,Deprecation,Sunset,Link,Warning",
        "baggage": "v=2,tid=d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2,uid=010177ba-8e02-420c-91a3-e6603f953767",
        "connection": "keep-alive",
        "content-length": "447",
        "content-security-policy": "default-src 'self';style-src 'self' 'unsafe-inline';script-src 'self';img-src 'self' data: https: blob: http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000;connect-src 'self' http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000 ws://localhost:4000 wss://localhost:4000 ws://localhost:5000 wss://localhost:5000;font-src 'self' data: https://fonts.gstatic.com;object-src 'none';media-src 'self';frame-src 'none';base-uri 'self';form-action 'self';frame-ancestors 'none';script-src-attr 'none';upgrade-insecure-requests",
        "content-type": "application/json; charset=utf-8",
        "cross-origin-embedder-policy": "unsafe-none",
        "cross-origin-opener-policy": "unsafe-none",
        "cross-origin-resource-policy": "cross-origin",
        "date": "Fri, 20 Mar 2026 17:31:05 GMT",
        "etag": "W/\"1bf-zJeluYguCSB+iXRhm083g8DQrG4\"",
        "keep-alive": "timeout=5",
        "origin-agent-cluster": "?1",
        "referrer-policy": "strict-origin-when-cross-origin",
        "traceparent": "00-39e271dbb6f140869b9996701a64430b-b7b15118d31441a4-01",
        "vary": "x-api-version, Origin",
        "x-api-deprecated": "false",
        "x-api-latest-version": "2",
        "x-api-supported-versions": "2",
        "x-api-version": "2",
        "x-content-type-options": "nosniff",
        "x-dns-prefetch-control": "off",
        "x-download-options": "noopen",
        "x-frame-options": "DENY",
        "x-permitted-cross-domain-policies": "none",
        "x-request-id": "c55e5b63-e003-46c9-8521-4ce7f5bebd66",
        "x-trace-id": "39e271dbb6f140869b9996701a64430b",
        "x-xss-protection": "0"
      },
      "body": {
        "ok": true,
        "operation": "fair-queue-hold",
        "instanceId": "backend-a",
        "tenantId": "d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2",
        "userId": "010177ba-8e02-420c-91a3-e6603f953767",
        "configuredDelayMs": 100,
        "startedAt": "2026-03-20T17:31:05.724Z",
        "completedAt": "2026-03-20T17:31:05.830Z",
        "durationMs": 106,
        "trace": {
          "requestId": "c55e5b63-e003-46c9-8521-4ce7f5bebd66",
          "traceId": "39e271dbb6f140869b9996701a64430b",
          "apiVersion": "2",
          "mitigationFlags": [],
          "baggageBytes": 85
        }
      }
    },
    {
      "label": "tenant-a-down-b",
      "baseUrl": "http://127.0.0.1:4102",
      "routePath": "/api/ops-runtime-test/fair-queue/hold?holdMs=1200",
      "sentAt": "2026-03-20T17:31:05.698Z",
      "completedAt": "2026-03-20T17:31:05.831Z",
      "durationMs": 133,
      "queueWaitMs": 28,
      "status": 201,
      "ok": true,
      "headers": {
        "access-control-allow-credentials": "true",
        "access-control-expose-headers": "Content-Type,Content-Length,Content-Encoding,X-Request-Id,X-Trace-Id,Traceparent,Baggage,X-Total-Count,X-API-Version,X-API-Latest-Version,X-API-Supported-Versions,X-API-Deprecated,Deprecation,Sunset,Link,Warning",
        "baggage": "v=2,tid=d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2,uid=010177ba-8e02-420c-91a3-e6603f953767",
        "connection": "keep-alive",
        "content-length": "447",
        "content-security-policy": "default-src 'self';style-src 'self' 'unsafe-inline';script-src 'self';img-src 'self' data: https: blob: http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000;connect-src 'self' http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000 ws://localhost:4000 wss://localhost:4000 ws://localhost:5000 wss://localhost:5000;font-src 'self' data: https://fonts.gstatic.com;object-src 'none';media-src 'self';frame-src 'none';base-uri 'self';form-action 'self';frame-ancestors 'none';script-src-attr 'none';upgrade-insecure-requests",
        "content-type": "application/json; charset=utf-8",
        "cross-origin-embedder-policy": "unsafe-none",
        "cross-origin-opener-policy": "unsafe-none",
        "cross-origin-resource-policy": "cross-origin",
        "date": "Fri, 20 Mar 2026 17:31:05 GMT",
        "etag": "W/\"1bf-nfjBHLcUVE5EqND9H/7GfGhX8aE\"",
        "keep-alive": "timeout=5",
        "origin-agent-cluster": "?1",
        "referrer-policy": "strict-origin-when-cross-origin",
        "traceparent": "00-cff2bd10a3bb4579908d6f3ed15406c6-bd60fc3739694d51-01",
        "vary": "x-api-version, Origin",
        "x-api-deprecated": "false",
        "x-api-latest-version": "2",
        "x-api-supported-versions": "2",
        "x-api-version": "2",
        "x-content-type-options": "nosniff",
        "x-dns-prefetch-control": "off",
        "x-download-options": "noopen",
        "x-frame-options": "DENY",
        "x-permitted-cross-domain-policies": "none",
        "x-request-id": "b95146a1-14ba-4d90-9632-6152fdf87b3b",
        "x-trace-id": "cff2bd10a3bb4579908d6f3ed15406c6",
        "x-xss-protection": "0"
      },
      "body": {
        "ok": true,
        "operation": "fair-queue-hold",
        "instanceId": "backend-b",
        "tenantId": "d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2",
        "userId": "010177ba-8e02-420c-91a3-e6603f953767",
        "configuredDelayMs": 100,
        "startedAt": "2026-03-20T17:31:05.726Z",
        "completedAt": "2026-03-20T17:31:05.830Z",
        "durationMs": 104,
        "trace": {
          "requestId": "b95146a1-14ba-4d90-9632-6152fdf87b3b",
          "traceId": "cff2bd10a3bb4579908d6f3ed15406c6",
          "apiVersion": "2",
          "mitigationFlags": [],
          "baggageBytes": 85
        }
      }
    }
  ],
  "simultaneousStartDeltaMs": 2
}
```

## redis-intermittent

- Titulo: Redis lento e intermitente via Toxiproxy
- Duracao: 6457 ms
- Esperado: Health snapshot e payload operacional devem refletir latencia/falha Redis com degradacao explicita.
- Observado:
```json
{
  "traffic": [
    {
      "label": "intermittent-1",
      "baseUrl": "http://127.0.0.1:4101",
      "routePath": "/api/ops-runtime-test/fair-queue/hold?holdMs=700",
      "sentAt": "2026-03-20T17:31:13.012Z",
      "completedAt": "2026-03-20T17:31:13.167Z",
      "durationMs": 155,
      "queueWaitMs": 47,
      "status": 201,
      "ok": true,
      "headers": {
        "access-control-allow-credentials": "true",
        "access-control-expose-headers": "Content-Type,Content-Length,Content-Encoding,X-Request-Id,X-Trace-Id,Traceparent,Baggage,X-Total-Count,X-API-Version,X-API-Latest-Version,X-API-Supported-Versions,X-API-Deprecated,Deprecation,Sunset,Link,Warning",
        "baggage": "v=2,tid=d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2,uid=010177ba-8e02-420c-91a3-e6603f953767",
        "connection": "keep-alive",
        "content-length": "447",
        "content-security-policy": "default-src 'self';style-src 'self' 'unsafe-inline';script-src 'self';img-src 'self' data: https: blob: http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000;connect-src 'self' http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000 ws://localhost:4000 wss://localhost:4000 ws://localhost:5000 wss://localhost:5000;font-src 'self' data: https://fonts.gstatic.com;object-src 'none';media-src 'self';frame-src 'none';base-uri 'self';form-action 'self';frame-ancestors 'none';script-src-attr 'none';upgrade-insecure-requests",
        "content-type": "application/json; charset=utf-8",
        "cross-origin-embedder-policy": "unsafe-none",
        "cross-origin-opener-policy": "unsafe-none",
        "cross-origin-resource-policy": "cross-origin",
        "date": "Fri, 20 Mar 2026 17:31:13 GMT",
        "etag": "W/\"1bf-OWxZCTaYlDl1LYFFeKlaFrzL70s\"",
        "keep-alive": "timeout=5",
        "origin-agent-cluster": "?1",
        "referrer-policy": "strict-origin-when-cross-origin",
        "traceparent": "00-8134e05aaafd4787b24ad78d26e87aa3-97d13cf0cb5a4721-01",
        "vary": "x-api-version, Origin",
        "x-api-deprecated": "false",
        "x-api-latest-version": "2",
        "x-api-supported-versions": "2",
        "x-api-version": "2",
        "x-content-type-options": "nosniff",
        "x-dns-prefetch-control": "off",
        "x-download-options": "noopen",
        "x-frame-options": "DENY",
        "x-permitted-cross-domain-policies": "none",
        "x-request-id": "f936ca32-74c3-496a-b8c9-605cbbe8b1b2",
        "x-trace-id": "8134e05aaafd4787b24ad78d26e87aa3",
        "x-xss-protection": "0"
      },
      "body": {
        "ok": true,
        "operation": "fair-queue-hold",
        "instanceId": "backend-a",
        "tenantId": "d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2",
        "userId": "010177ba-8e02-420c-91a3-e6603f953767",
        "configuredDelayMs": 100,
        "startedAt": "2026-03-20T17:31:13.059Z",
        "completedAt": "2026-03-20T17:31:13.166Z",
        "durationMs": 107,
        "trace": {
          "requestId": "f936ca32-74c3-496a-b8c9-605cbbe8b1b2",
          "traceId": "8134e05aaafd4787b24ad78d26e87aa3",
          "apiVersion": "2",
          "mitigationFlags": [],
          "baggageBytes": 85
        }
      }
    },
    {
      "label": "intermittent-2",
      "baseUrl": "http://127.0.0.1:4102",
      "routePath": "/api/ops-runtime-test/fair-queue/hold?holdMs=700",
      "sentAt": "2026-03-20T17:31:13.012Z",
      "completedAt": "2026-03-20T17:31:13.169Z",
      "durationMs": 157,
      "queueWaitMs": 43,
      "status": 201,
      "ok": true,
      "headers": {
        "access-control-allow-credentials": "true",
        "access-control-expose-headers": "Content-Type,Content-Length,Content-Encoding,X-Request-Id,X-Trace-Id,Traceparent,Baggage,X-Total-Count,X-API-Version,X-API-Latest-Version,X-API-Supported-Versions,X-API-Deprecated,Deprecation,Sunset,Link,Warning",
        "baggage": "v=2,tid=d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2,uid=010177ba-8e02-420c-91a3-e6603f953767",
        "connection": "keep-alive",
        "content-length": "447",
        "content-security-policy": "default-src 'self';style-src 'self' 'unsafe-inline';script-src 'self';img-src 'self' data: https: blob: http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000;connect-src 'self' http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000 ws://localhost:4000 wss://localhost:4000 ws://localhost:5000 wss://localhost:5000;font-src 'self' data: https://fonts.gstatic.com;object-src 'none';media-src 'self';frame-src 'none';base-uri 'self';form-action 'self';frame-ancestors 'none';script-src-attr 'none';upgrade-insecure-requests",
        "content-type": "application/json; charset=utf-8",
        "cross-origin-embedder-policy": "unsafe-none",
        "cross-origin-opener-policy": "unsafe-none",
        "cross-origin-resource-policy": "cross-origin",
        "date": "Fri, 20 Mar 2026 17:31:13 GMT",
        "etag": "W/\"1bf-2UUVkzExArPsSeY/vySXFyCsxoQ\"",
        "keep-alive": "timeout=5",
        "origin-agent-cluster": "?1",
        "referrer-policy": "strict-origin-when-cross-origin",
        "traceparent": "00-205d174388144655b19f137a848a559c-d26fdf08f3c14396-01",
        "vary": "x-api-version, Origin",
        "x-api-deprecated": "false",
        "x-api-latest-version": "2",
        "x-api-supported-versions": "2",
        "x-api-version": "2",
        "x-content-type-options": "nosniff",
        "x-dns-prefetch-control": "off",
        "x-download-options": "noopen",
        "x-frame-options": "DENY",
        "x-permitted-cross-domain-policies": "none",
        "x-request-id": "e8d20c04-dda4-45ea-b6ff-634dfa0da644",
        "x-trace-id": "205d174388144655b19f137a848a559c",
        "x-xss-protection": "0"
      },
      "body": {
        "ok": true,
        "operation": "fair-queue-hold",
        "instanceId": "backend-b",
        "tenantId": "d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2",
        "userId": "010177ba-8e02-420c-91a3-e6603f953767",
        "configuredDelayMs": 100,
        "startedAt": "2026-03-20T17:31:13.055Z",
        "completedAt": "2026-03-20T17:31:13.166Z",
        "durationMs": 111,
        "trace": {
          "requestId": "e8d20c04-dda4-45ea-b6ff-634dfa0da644",
          "traceId": "205d174388144655b19f137a848a559c",
          "apiVersion": "2",
          "mitigationFlags": [],
          "baggageBytes": 85
        }
      }
    },
    {
      "label": "intermittent-3",
      "baseUrl": "http://127.0.0.1:4101",
      "routePath": "/api/ops-runtime-test/fair-queue/hold?holdMs=700",
      "sentAt": "2026-03-20T17:31:13.013Z",
      "completedAt": "2026-03-20T17:31:13.305Z",
      "durationMs": 292,
      "queueWaitMs": 185,
      "status": 201,
      "ok": true,
      "headers": {
        "access-control-allow-credentials": "true",
        "access-control-expose-headers": "Content-Type,Content-Length,Content-Encoding,X-Request-Id,X-Trace-Id,Traceparent,Baggage,X-Total-Count,X-API-Version,X-API-Latest-Version,X-API-Supported-Versions,X-API-Deprecated,Deprecation,Sunset,Link,Warning",
        "baggage": "v=2,tid=d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2,uid=010177ba-8e02-420c-91a3-e6603f953767",
        "connection": "keep-alive",
        "content-length": "447",
        "content-security-policy": "default-src 'self';style-src 'self' 'unsafe-inline';script-src 'self';img-src 'self' data: https: blob: http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000;connect-src 'self' http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000 ws://localhost:4000 wss://localhost:4000 ws://localhost:5000 wss://localhost:5000;font-src 'self' data: https://fonts.gstatic.com;object-src 'none';media-src 'self';frame-src 'none';base-uri 'self';form-action 'self';frame-ancestors 'none';script-src-attr 'none';upgrade-insecure-requests",
        "content-type": "application/json; charset=utf-8",
        "cross-origin-embedder-policy": "unsafe-none",
        "cross-origin-opener-policy": "unsafe-none",
        "cross-origin-resource-policy": "cross-origin",
        "date": "Fri, 20 Mar 2026 17:31:13 GMT",
        "etag": "W/\"1bf-sNSO/ybOp+KN3Qf431odrJYG0r4\"",
        "keep-alive": "timeout=5",
        "origin-agent-cluster": "?1",
        "referrer-policy": "strict-origin-when-cross-origin",
        "traceparent": "00-73e4d4a2920c44d58903b04979ac078c-89513e24a85d485d-01",
        "vary": "x-api-version, Origin",
        "x-api-deprecated": "false",
        "x-api-latest-version": "2",
        "x-api-supported-versions": "2",
        "x-api-version": "2",
        "x-content-type-options": "nosniff",
        "x-dns-prefetch-control": "off",
        "x-download-options": "noopen",
        "x-frame-options": "DENY",
        "x-permitted-cross-domain-policies": "none",
        "x-request-id": "556288f6-08be-4074-94b3-d3a047f08f0b",
        "x-trace-id": "73e4d4a2920c44d58903b04979ac078c",
        "x-xss-protection": "0"
      },
      "body": {
        "ok": true,
        "operation": "fair-queue-hold",
        "instanceId": "backend-a",
        "tenantId": "d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2",
        "userId": "010177ba-8e02-420c-91a3-e6603f953767",
        "configuredDelayMs": 100,
        "startedAt": "2026-03-20T17:31:13.198Z",
        "completedAt": "2026-03-20T17:31:13.300Z",
        "durationMs": 102,
        "trace": {
          "requestId": "556288f6-08be-4074-94b3-d3a047f08f0b",
          "traceId": "73e4d4a2920c44d58903b04979ac078c",
          "apiVersion": "2",
          "mitigationFlags": [],
          "baggageBytes": 85
        }
      }
    },
    {
      "label": "intermittent-4",
      "baseUrl": "http://127.0.0.1:4102",
      "routePath": "/api/ops-runtime-test/fair-queue/hold?holdMs=700",
      "sentAt": "2026-03-20T17:31:13.013Z",
      "completedAt": "2026-03-20T17:31:13.306Z",
      "durationMs": 293,
      "queueWaitMs": 186,
      "status": 201,
      "ok": true,
      "headers": {
        "access-control-allow-credentials": "true",
        "access-control-expose-headers": "Content-Type,Content-Length,Content-Encoding,X-Request-Id,X-Trace-Id,Traceparent,Baggage,X-Total-Count,X-API-Version,X-API-Latest-Version,X-API-Supported-Versions,X-API-Deprecated,Deprecation,Sunset,Link,Warning",
        "baggage": "v=2,tid=d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2,uid=010177ba-8e02-420c-91a3-e6603f953767",
        "connection": "keep-alive",
        "content-length": "447",
        "content-security-policy": "default-src 'self';style-src 'self' 'unsafe-inline';script-src 'self';img-src 'self' data: https: blob: http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000;connect-src 'self' http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000 ws://localhost:4000 wss://localhost:4000 ws://localhost:5000 wss://localhost:5000;font-src 'self' data: https://fonts.gstatic.com;object-src 'none';media-src 'self';frame-src 'none';base-uri 'self';form-action 'self';frame-ancestors 'none';script-src-attr 'none';upgrade-insecure-requests",
        "content-type": "application/json; charset=utf-8",
        "cross-origin-embedder-policy": "unsafe-none",
        "cross-origin-opener-policy": "unsafe-none",
        "cross-origin-resource-policy": "cross-origin",
        "date": "Fri, 20 Mar 2026 17:31:13 GMT",
        "etag": "W/\"1bf-VzDPZoTBE1k5tvngf32x1xXyuZw\"",
        "keep-alive": "timeout=5",
        "origin-agent-cluster": "?1",
        "referrer-policy": "strict-origin-when-cross-origin",
        "traceparent": "00-d54be80e3b264c569f55d243c32a1200-d7c069379de24f84-01",
        "vary": "x-api-version, Origin",
        "x-api-deprecated": "false",
        "x-api-latest-version": "2",
        "x-api-supported-versions": "2",
        "x-api-version": "2",
        "x-content-type-options": "nosniff",
        "x-dns-prefetch-control": "off",
        "x-download-options": "noopen",
        "x-frame-options": "DENY",
        "x-permitted-cross-domain-policies": "none",
        "x-request-id": "c4e255a9-a09e-4a38-94cb-7defdaeb40da",
        "x-trace-id": "d54be80e3b264c569f55d243c32a1200",
        "x-xss-protection": "0"
      },
      "body": {
        "ok": true,
        "operation": "fair-queue-hold",
        "instanceId": "backend-b",
        "tenantId": "d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2",
        "userId": "010177ba-8e02-420c-91a3-e6603f953767",
        "configuredDelayMs": 100,
        "startedAt": "2026-03-20T17:31:13.199Z",
        "completedAt": "2026-03-20T17:31:13.300Z",
        "durationMs": 101,
        "trace": {
          "requestId": "c4e255a9-a09e-4a38-94cb-7defdaeb40da",
          "traceId": "d54be80e3b264c569f55d243c32a1200",
          "apiVersion": "2",
          "mitigationFlags": [],
          "baggageBytes": 85
        }
      }
    }
  ],
  "backendA": {
    "distributedState": {
      "enabled": true,
      "valid": true,
      "configured": true,
      "mode": "standalone",
      "ready": false,
      "fallbackActive": true,
      "required": false,
      "fallbackMode": "memory",
      "status": "connect",
      "detail": "Stream isn't writeable and enableOfflineQueue options is false"
    },
    "lock": {
      "enabled": true,
      "valid": true,
      "configured": true,
      "mode": "standalone",
      "ready": false,
      "fallbackActive": true,
      "required": false,
      "fallbackMode": "memory",
      "status": "connect",
      "detail": "Stream isn't writeable and enableOfflineQueue options is false"
    }
  },
  "backendB": {
    "distributedState": {
      "enabled": true,
      "valid": true,
      "configured": true,
      "mode": "standalone",
      "ready": false,
      "fallbackActive": true,
      "required": false,
      "fallbackMode": "memory",
      "status": "connect",
      "detail": "Stream isn't writeable and enableOfflineQueue options is false"
    },
    "lock": {
      "enabled": true,
      "valid": true,
      "configured": true,
      "mode": "standalone",
      "ready": false,
      "fallbackActive": true,
      "required": false,
      "fallbackMode": "memory",
      "status": "connect",
      "detail": "Stream isn't writeable and enableOfflineQueue options is false"
    }
  },
  "dashboardRedis": {
    "status": "degraded",
    "error": "Dependencia Redis mitigada automaticamente sob pressao distribuida."
  },
  "stateConsistency": {
    "backendA": "local_fallback",
    "backendB": "local_fallback"
  }
}
```

## breaker-quorum

- Titulo: Breaker distribuido com quorum
- Duracao: 4993 ms
- Esperado: Uma falha isolada nao deve abrir circuito; duas instancias votando devem abrir, half-open deve permitir probes limitados e recuperar gradualmente.
- Observado:
```json
{
  "firstFailure": {
    "ok": false,
    "statusCode": 502,
    "mode": "failure",
    "instanceId": "backend-a",
    "durationMs": 79,
    "tenantId": "d4f9082b-81f1-4971-973b-5dc03e693399",
    "trace": {
      "requestId": "6a5dfb25-c72f-4390-9afe-c85e288b90bb",
      "traceId": "22abaaad0d6e4346ac8e3b7cc2f9d52a",
      "apiVersion": "2",
      "mitigationFlags": [],
      "baggageBytes": 85
    },
    "breaker": {
      "key": "dependency:ops-runtime-test",
      "mode": "closed",
      "failures": 1,
      "openCount": 0,
      "openedUntil": null,
      "halfOpenInFlight": 0,
      "halfOpenProbeAttempts": 0,
      "halfOpenSuccesses": 0,
      "consecutiveSuccesses": 0,
      "lastTransitionAt": 1774027877484,
      "failureVoters": 1,
      "recoveryVoters": 0
    },
    "error": {
      "message": "Dependencia de teste respondeu 503"
    }
  },
  "secondFailure": {
    "ok": false,
    "statusCode": 502,
    "mode": "failure",
    "instanceId": "backend-b",
    "durationMs": 80,
    "tenantId": "d4f9082b-81f1-4971-973b-5dc03e693399",
    "trace": {
      "requestId": "d376dc0e-51b5-4ed9-83db-1e0964ad6a0c",
      "traceId": "969235c2f5fc47419eff50be4b6cdc24",
      "apiVersion": "2",
      "mitigationFlags": [],
      "baggageBytes": 85
    },
    "breaker": {
      "key": "dependency:ops-runtime-test",
      "mode": "open",
      "failures": 2,
      "openCount": 1,
      "openedUntil": 1774027881285,
      "halfOpenInFlight": 0,
      "halfOpenProbeAttempts": 0,
      "halfOpenSuccesses": 0,
      "consecutiveSuccesses": 0,
      "lastTransitionAt": 1774027877677,
      "failureVoters": 2,
      "recoveryVoters": 0
    },
    "error": {
      "message": "Dependencia de teste respondeu 503"
    }
  },
  "circuitOpen": {
    "ok": false,
    "statusCode": 503,
    "mode": "circuit-open",
    "instanceId": "backend-a",
    "durationMs": 8,
    "tenantId": "d4f9082b-81f1-4971-973b-5dc03e693399",
    "trace": {
      "requestId": "17fb23fa-ed8d-4483-99fa-85e600ff9372",
      "traceId": "eb2f7ddbebbf445b88e3ca0655d51ac5",
      "apiVersion": "2",
      "mitigationFlags": [],
      "baggageBytes": 85
    },
    "breaker": {
      "key": "dependency:ops-runtime-test",
      "mode": "open",
      "failures": 2,
      "openCount": 1,
      "openedUntil": 1774027881285,
      "halfOpenInFlight": 0,
      "halfOpenProbeAttempts": 0,
      "halfOpenSuccesses": 0,
      "consecutiveSuccesses": 0,
      "lastTransitionAt": 1774027877677,
      "failureVoters": 2,
      "recoveryVoters": 0
    },
    "error": {
      "message": "Circuit breaker aberto para dependency:ops-runtime-test",
      "retryAfterMs": 3572
    }
  },
  "recoveryProbeA": {
    "ok": true,
    "statusCode": 200,
    "mode": "ok",
    "instanceId": "backend-a",
    "durationMs": 29,
    "tenantId": "d4f9082b-81f1-4971-973b-5dc03e693399",
    "trace": {
      "requestId": "136b968d-113a-4634-a475-1c9f51727f77",
      "traceId": "91056029ad9e448d8a947b3046ccf13e",
      "apiVersion": "2",
      "mitigationFlags": [],
      "baggageBytes": 85
    },
    "breaker": {
      "key": "dependency:ops-runtime-test",
      "mode": "half-open",
      "failures": 2,
      "openCount": 1,
      "openedUntil": 1774027881285,
      "halfOpenInFlight": 0,
      "halfOpenProbeAttempts": 1,
      "halfOpenSuccesses": 1,
      "consecutiveSuccesses": 1,
      "lastTransitionAt": 1774027882280,
      "failureVoters": 1,
      "recoveryVoters": 1
    },
    "dependency": {
      "url": "http://127.0.0.1:46460/dependency",
      "status": 200,
      "body": {
        "ok": true,
        "mode": "ok",
        "delayedMs": 0
      },
      "traceHeaders": {
        "x-request-id": "136b968d-113a-4634-a475-1c9f51727f77",
        "x-trace-id": "91056029ad9e448d8a947b3046ccf13e",
        "traceparent": "00-91056029ad9e448d8a947b3046ccf13e-c4cabf12c26441d4-01",
        "baggage": "v=2,tid=d4f9082b-81f1-4971-973b-5dc03e693399,uid=9661c781-05b4-438a-b177-736bdfa5767d"
      }
    }
  },
  "recoveryProbeB": {
    "ok": true,
    "statusCode": 200,
    "mode": "ok",
    "instanceId": "backend-b",
    "durationMs": 29,
    "tenantId": "d4f9082b-81f1-4971-973b-5dc03e693399",
    "trace": {
      "requestId": "40c4e24f-9b65-4f7a-b2bd-7f4563776da4",
      "traceId": "c706ec5b35c14a5ba7ef79966d230efe",
      "apiVersion": "2",
      "mitigationFlags": [],
      "baggageBytes": 85
    },
    "breaker": {
      "key": "dependency:ops-runtime-test",
      "mode": "closed",
      "failures": 0,
      "openCount": 0,
      "openedUntil": null,
      "halfOpenInFlight": 0,
      "halfOpenProbeAttempts": 0,
      "halfOpenSuccesses": 0,
      "consecutiveSuccesses": 2,
      "lastTransitionAt": 1774027882357,
      "failureVoters": 0,
      "recoveryVoters": 0
    },
    "dependency": {
      "url": "http://127.0.0.1:46460/dependency",
      "status": 200,
      "body": {
        "ok": true,
        "mode": "ok",
        "delayedMs": 0
      },
      "traceHeaders": {
        "x-request-id": "40c4e24f-9b65-4f7a-b2bd-7f4563776da4",
        "x-trace-id": "c706ec5b35c14a5ba7ef79966d230efe",
        "traceparent": "00-c706ec5b35c14a5ba7ef79966d230efe-c5273baa70f74204-01",
        "baggage": "v=2,tid=d4f9082b-81f1-4971-973b-5dc03e693399,uid=9661c781-05b4-438a-b177-736bdfa5767d"
      }
    }
  },
  "recovered": {
    "ok": true,
    "statusCode": 200,
    "mode": "ok",
    "instanceId": "backend-a",
    "durationMs": 21,
    "tenantId": "d4f9082b-81f1-4971-973b-5dc03e693399",
    "trace": {
      "requestId": "5ace9df1-63bb-4dc6-8430-2970633933f5",
      "traceId": "6457a62a97df488f91904ff9c1877b15",
      "apiVersion": "2",
      "mitigationFlags": [],
      "baggageBytes": 85
    },
    "breaker": {
      "key": "dependency:ops-runtime-test",
      "mode": "closed",
      "failures": 0,
      "openCount": 0,
      "openedUntil": null,
      "halfOpenInFlight": 0,
      "halfOpenProbeAttempts": 0,
      "halfOpenSuccesses": 0,
      "consecutiveSuccesses": 3,
      "lastTransitionAt": 1774027882407,
      "failureVoters": 0,
      "recoveryVoters": 0
    },
    "dependency": {
      "url": "http://127.0.0.1:46460/dependency",
      "status": 200,
      "body": {
        "ok": true,
        "mode": "ok",
        "delayedMs": 0
      },
      "traceHeaders": {
        "x-request-id": "5ace9df1-63bb-4dc6-8430-2970633933f5",
        "x-trace-id": "6457a62a97df488f91904ff9c1877b15",
        "traceparent": "00-6457a62a97df488f91904ff9c1877b15-7ac9be309b1e4238-01",
        "baggage": "v=2,tid=d4f9082b-81f1-4971-973b-5dc03e693399,uid=9661c781-05b4-438a-b177-736bdfa5767d"
      }
    }
  }
}
```

## granular-shedding

- Titulo: Shedding granular por tenant e rota
- Duracao: 1503 ms
- Esperado: Tenant pesado deve receber factor reduzido e causa tenant-route, enquanto tenant leve permanece sem penalizacao injusta.
- Observado:
```json
{
  "hammer": {
    "total": 10,
    "blocked": 6,
    "avgQueueWaitMs": 317,
    "maxQueueWaitMs": 548
  },
  "tenantAContext": {
    "instanceId": "backend-a",
    "tenantId": "d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2",
    "path": "/api/ops-runtime-test/fair-queue/hold",
    "trace": {
      "requestId": "224abedb-956d-41c5-94ba-2ff475af4991",
      "traceId": "7f92194ac6004d58b7deb95e22d3bbcd",
      "apiVersion": "2",
      "mitigationFlags": [],
      "baggageBytes": 85
    },
    "factor": 0.55,
    "cause": "tenant-route:ops-runtime-test-fair-queue",
    "scope": "tenant-route",
    "signalScore": 18,
    "snapshot": {
      "instanceId": "backend-a",
      "instanceCount": 2,
      "overloadedInstances": 0,
      "adaptiveThrottleFactor": 1,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "stateConsistency": "distributed",
      "local": {
        "eventLoopLagP95Ms": 32.36,
        "eventLoopLagP99Ms": 35.29,
        "eventLoopLagMaxMs": 35.29,
        "eventLoopUtilization": 0.1368,
        "heapUsedRatio": 0.9102,
        "recentApiLatencyMs": 184.4,
        "gcPauseP95Ms": 8.24,
        "gcPauseMaxMs": 20.6,
        "gcEventsRecent": 21,
        "queueDepth": 0,
        "activeIsolatedRequests": 0,
        "pressureScore": 0,
        "consecutiveBreaches": 0,
        "adaptiveThrottleFactor": 1,
        "cause": "normal",
        "overloaded": false
      },
      "clusterRecentApiLatencyMs": 225.58,
      "clusterQueueDepth": 3,
      "mitigation": {
        "degradeHeavyFeatures": false,
        "disableRemoteUpdateChecks": false,
        "rejectHeavyMutations": false,
        "featureFlags": [],
        "businessImpact": []
      }
    }
  },
  "tenantBContext": {
    "instanceId": "backend-a",
    "tenantId": "298bc3b7-e571-41ea-bd4b-bbba0c37f782",
    "path": "/api/ops-runtime-test/fair-queue/hold",
    "trace": {
      "requestId": "0def358d-dfc1-42ae-a93b-8ee42792107b",
      "traceId": "aba21d7e850d42caa4cd430b908c3c8d",
      "apiVersion": "2",
      "mitigationFlags": [],
      "baggageBytes": 85
    },
    "factor": 1,
    "cause": null,
    "scope": "cluster",
    "signalScore": 0,
    "snapshot": {
      "instanceId": "backend-a",
      "instanceCount": 2,
      "overloadedInstances": 0,
      "adaptiveThrottleFactor": 1,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "stateConsistency": "distributed",
      "local": {
        "eventLoopLagP95Ms": 32.36,
        "eventLoopLagP99Ms": 35.29,
        "eventLoopLagMaxMs": 35.29,
        "eventLoopUtilization": 0.1368,
        "heapUsedRatio": 0.9102,
        "recentApiLatencyMs": 184.4,
        "gcPauseP95Ms": 8.24,
        "gcPauseMaxMs": 20.6,
        "gcEventsRecent": 21,
        "queueDepth": 0,
        "activeIsolatedRequests": 0,
        "pressureScore": 0,
        "consecutiveBreaches": 0,
        "adaptiveThrottleFactor": 1,
        "cause": "normal",
        "overloaded": false
      },
      "clusterRecentApiLatencyMs": 225.58,
      "clusterQueueDepth": 3,
      "mitigation": {
        "degradeHeavyFeatures": false,
        "disableRemoteUpdateChecks": false,
        "rejectHeavyMutations": false,
        "featureFlags": [],
        "businessImpact": []
      }
    }
  }
}
```

## adaptive-rate-limit

- Titulo: Throttling adaptativo com smoothing e hysteresis
- Duracao: 12666 ms
- Esperado: Adaptive factor deve cair com suavizacao, nao oscilar agressivamente e recuperar de forma gradual apos estabilidade.
- Observado:
```json
{
  "underLoadSamples": [
    {
      "at": "2026-03-20T17:31:24.218Z",
      "adaptiveThrottleFactor": 0.89,
      "desiredAdaptiveThrottleFactor": 0.75,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 207.75,
      "clusterQueueDepth": 4,
      "featureFlags": []
    },
    {
      "at": "2026-03-20T17:31:25.262Z",
      "adaptiveThrottleFactor": 0.89,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 210.83,
      "clusterQueueDepth": 1,
      "featureFlags": []
    },
    {
      "at": "2026-03-20T17:31:26.294Z",
      "adaptiveThrottleFactor": 0.89,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 200.94,
      "clusterQueueDepth": 1,
      "featureFlags": []
    },
    {
      "at": "2026-03-20T17:31:27.351Z",
      "adaptiveThrottleFactor": 0.94,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 191.94,
      "clusterQueueDepth": 0,
      "featureFlags": []
    },
    {
      "at": "2026-03-20T17:31:28.398Z",
      "adaptiveThrottleFactor": 0.99,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 185.59,
      "clusterQueueDepth": 0,
      "featureFlags": []
    },
    {
      "at": "2026-03-20T17:31:29.439Z",
      "adaptiveThrottleFactor": 0.99,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 183.76,
      "clusterQueueDepth": 0,
      "featureFlags": []
    }
  ],
  "recoverySamples": [
    {
      "at": "2026-03-20T17:31:30.485Z",
      "adaptiveThrottleFactor": 0.99,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 182.05,
      "clusterQueueDepth": 0,
      "featureFlags": []
    },
    {
      "at": "2026-03-20T17:31:31.531Z",
      "adaptiveThrottleFactor": 0.99,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 180.41,
      "clusterQueueDepth": 0,
      "featureFlags": []
    },
    {
      "at": "2026-03-20T17:31:32.564Z",
      "adaptiveThrottleFactor": 0.99,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 178.85,
      "clusterQueueDepth": 0,
      "featureFlags": []
    },
    {
      "at": "2026-03-20T17:31:33.600Z",
      "adaptiveThrottleFactor": 0.99,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 177.36,
      "clusterQueueDepth": 0,
      "featureFlags": []
    },
    {
      "at": "2026-03-20T17:31:34.645Z",
      "adaptiveThrottleFactor": 0.99,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 175.94,
      "clusterQueueDepth": 0,
      "featureFlags": []
    }
  ],
  "underLoadRateLimitBodies": [
    {
      "at": "2026-03-20T17:31:24.215Z",
      "status": 200,
      "adaptiveFactor": 1,
      "pressureCause": null,
      "routePolicyId": "ops-runtime-test-rate-limit"
    },
    {
      "at": "2026-03-20T17:31:24.710Z",
      "status": 200,
      "adaptiveFactor": 1,
      "pressureCause": null,
      "routePolicyId": "ops-runtime-test-rate-limit"
    },
    {
      "at": "2026-03-20T17:31:25.206Z",
      "status": 200,
      "adaptiveFactor": 1,
      "pressureCause": null,
      "routePolicyId": "ops-runtime-test-rate-limit"
    },
    {
      "at": "2026-03-20T17:31:25.714Z",
      "status": 200,
      "adaptiveFactor": 1,
      "pressureCause": null,
      "routePolicyId": "ops-runtime-test-rate-limit"
    },
    {
      "at": "2026-03-20T17:31:26.211Z",
      "status": 200,
      "adaptiveFactor": 1,
      "pressureCause": null,
      "routePolicyId": "ops-runtime-test-rate-limit"
    },
    {
      "at": "2026-03-20T17:31:26.706Z",
      "status": 200,
      "adaptiveFactor": 1,
      "pressureCause": null,
      "routePolicyId": "ops-runtime-test-rate-limit"
    }
  ],
  "recoveryRateLimitBodies": [
    {
      "at": "2026-03-20T17:31:35.687Z",
      "status": 200,
      "adaptiveFactor": 1,
      "pressureCause": null,
      "routePolicyId": "ops-runtime-test-rate-limit"
    },
    {
      "at": "2026-03-20T17:31:35.991Z",
      "status": 200,
      "adaptiveFactor": 1,
      "pressureCause": null,
      "routePolicyId": "ops-runtime-test-rate-limit"
    },
    {
      "at": "2026-03-20T17:31:36.289Z",
      "status": 200,
      "adaptiveFactor": 1,
      "pressureCause": null,
      "routePolicyId": "ops-runtime-test-rate-limit"
    },
    {
      "at": "2026-03-20T17:31:36.586Z",
      "status": 200,
      "adaptiveFactor": 1,
      "pressureCause": null,
      "routePolicyId": "ops-runtime-test-rate-limit"
    }
  ]
}
```

## trace-baggage

- Titulo: Trace e baggage sob controle
- Duracao: 3415 ms
- Esperado: Traceparent e baggage devem ser propagados com tenantId, userId, apiVersion e flags sem ultrapassar o limite configurado.
- Observado:
```json
{
  "dependencyResponse": {
    "ok": true,
    "statusCode": 200,
    "mode": "ok",
    "instanceId": "backend-a",
    "durationMs": 29,
    "tenantId": "d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2",
    "trace": {
      "requestId": "5fb47f46-89df-4886-befc-c02dc1377e9f",
      "traceId": "5a720539bc84439c9dc2332492f696b1",
      "apiVersion": "2",
      "mitigationFlags": [],
      "baggageBytes": 85
    },
    "breaker": {
      "key": "dependency:ops-runtime-test",
      "mode": "closed",
      "failures": 0,
      "openCount": 0,
      "openedUntil": null,
      "halfOpenInFlight": 0,
      "halfOpenProbeAttempts": 0,
      "halfOpenSuccesses": 0,
      "consecutiveSuccesses": 4,
      "lastTransitionAt": 1774027899991,
      "failureVoters": 0,
      "recoveryVoters": 0
    },
    "dependency": {
      "url": "http://127.0.0.1:46460/dependency",
      "status": 200,
      "body": {
        "ok": true,
        "mode": "ok",
        "delayedMs": 0
      },
      "traceHeaders": {
        "x-request-id": "5fb47f46-89df-4886-befc-c02dc1377e9f",
        "x-trace-id": "5a720539bc84439c9dc2332492f696b1",
        "traceparent": "00-5a720539bc84439c9dc2332492f696b1-1dcb8cc76d1d4936-01",
        "baggage": "v=2,tid=d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2,uid=010177ba-8e02-420c-91a3-e6603f953767"
      }
    }
  },
  "stubObserved": {
    "at": "2026-03-20T17:31:39.986Z",
    "method": "GET",
    "path": "/dependency",
    "traceparent": "00-5a720539bc84439c9dc2332492f696b1-1dcb8cc76d1d4936-01",
    "baggage": "v=2,tid=d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2,uid=010177ba-8e02-420c-91a3-e6603f953767",
    "baggageBytes": 85,
    "requestId": "5fb47f46-89df-4886-befc-c02dc1377e9f",
    "traceId": "5a720539bc84439c9dc2332492f696b1"
  },
  "baggageUnderControl": true
}
```

## slow-success

- Titulo: Sucesso lento com visibilidade operacional
- Duracao: 3154 ms
- Esperado: Sucesso lento deve aparecer em telemetria operacional, aumentar latencia percebida e influenciar mitigacao/alerta.
- Observado:
```json
{
  "responses": [
    {
      "status": 200,
      "durationMs": 2000
    },
    {
      "status": 200,
      "durationMs": 2000
    },
    {
      "status": 200,
      "durationMs": 2000
    },
    {
      "status": 200,
      "durationMs": 2000
    },
    {
      "status": 200,
      "durationMs": 2000
    }
  ],
  "operationalTelemetry": {
    "status": "ok",
    "windowStart": "2026-03-20T17:16:43.091Z",
    "windowSeconds": 900,
    "totalEventsRecent": 25,
    "byType": [
      {
        "type": "auto_mitigation",
        "count": 11
      },
      {
        "type": "request_queue_rejected",
        "count": 6
      },
      {
        "type": "request_queued",
        "count": 6
      },
      {
        "type": "circuit_half_open",
        "count": 1
      },
      {
        "type": "circuit_open",
        "count": 1
      }
    ],
    "topRoutes": [
      {
        "route": "/api/ops-runtime-test/fair-queue/hold",
        "count": 12
      },
      {
        "route": "/system/runtime/load-shedding",
        "count": 11
      },
      {
        "route": "/ops-runtime-test/dependency/check",
        "count": 2
      }
    ],
    "recent": [
      {
        "type": "auto_mitigation",
        "statusCode": null,
        "method": "UNKNOWN",
        "route": "/system/runtime/load-shedding",
        "requestId": null,
        "traceId": null,
        "tenantId": null,
        "userId": null,
        "apiVersion": null,
        "mitigationFlags": [],
        "detail": "adaptive load shedding factor=0.99 desired=1 overloadedInstances=0/2",
        "at": "2026-03-20T17:31:28.178Z"
      },
      {
        "type": "auto_mitigation",
        "statusCode": null,
        "method": "UNKNOWN",
        "route": "/system/runtime/load-shedding",
        "requestId": null,
        "traceId": null,
        "tenantId": null,
        "userId": null,
        "apiVersion": null,
        "mitigationFlags": [],
        "detail": "adaptive load shedding factor=0.94 desired=1 overloadedInstances=0/2",
        "at": "2026-03-20T17:31:27.180Z"
      },
      {
        "type": "auto_mitigation",
        "statusCode": null,
        "method": "UNKNOWN",
        "route": "/system/runtime/load-shedding",
        "requestId": null,
        "traceId": null,
        "tenantId": null,
        "userId": null,
        "apiVersion": null,
        "mitigationFlags": [],
        "detail": "adaptive load shedding factor=0.89 desired=0.75 overloadedInstances=0/2",
        "at": "2026-03-20T17:31:24.172Z"
      },
      {
        "type": "request_queue_rejected",
        "statusCode": 429,
        "method": "POST",
        "route": "/api/ops-runtime-test/fair-queue/hold",
        "requestId": "3fddec58-3792-4f64-9a3b-c8a9d668a252",
        "traceId": "f5edc7fb3f7045babe84ea8b2bdf50c3",
        "tenantId": "d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2",
        "userId": "010177ba-8e02-420c-91a3-e6603f953767",
        "apiVersion": "2",
        "mitigationFlags": [],
        "detail": "queue full route=ops-runtime-test-fair-queue partition=tenant:d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2 routeDepth=3 partitionDepth=3",
        "at": "2026-03-20T17:31:24.071Z"
      },
      {
        "type": "request_queue_rejected",
        "statusCode": 429,
        "method": "POST",
        "route": "/api/ops-runtime-test/fair-queue/hold",
        "requestId": "896b6e28-b162-4d88-bfa7-503d5d0d8024",
        "traceId": "9b47e2cbfbc043838fcbc668ce165922",
        "tenantId": "d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2",
        "userId": "010177ba-8e02-420c-91a3-e6603f953767",
        "apiVersion": "2",
        "mitigationFlags": [],
        "detail": "queue full route=ops-runtime-test-fair-queue partition=tenant:d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2 routeDepth=3 partitionDepth=3",
        "at": "2026-03-20T17:31:24.059Z"
      },
      {
        "type": "request_queue_rejected",
        "statusCode": 429,
        "method": "POST",
        "route": "/api/ops-runtime-test/fair-queue/hold",
        "requestId": "347d0099-108e-4669-9780-a5aefaf1678d",
        "traceId": "db7a511f51c7449a82aef8143c1347e4",
        "tenantId": "d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2",
        "userId": "010177ba-8e02-420c-91a3-e6603f953767",
        "apiVersion": "2",
        "mitigationFlags": [],
        "detail": "queue full route=ops-runtime-test-fair-queue partition=tenant:d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2 routeDepth=3 partitionDepth=3",
        "at": "2026-03-20T17:31:24.047Z"
      },
      {
        "type": "request_queued",
        "statusCode": null,
        "method": "POST",
        "route": "/api/ops-runtime-test/fair-queue/hold",
        "requestId": "d57df2d4-d055-475e-ac1c-fb1bd2505c48",
        "traceId": "941ffd0f544f4addbd1429e9e8a56b4d",
        "tenantId": "d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2",
        "userId": "010177ba-8e02-420c-91a3-e6603f953767",
        "apiVersion": "2",
        "mitigationFlags": [],
        "detail": "queued route=ops-runtime-test-fair-queue partition=tenant:d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2 routeDepth=3 partitionDepth=3",
        "at": "2026-03-20T17:31:24.002Z"
      },
      {
        "type": "request_queue_rejected",
        "statusCode": 429,
        "method": "POST",
        "route": "/api/ops-runtime-test/fair-queue/hold",
        "requestId": "7430828d-491b-4c79-a072-5efa02bec618",
        "traceId": "5804d7b1a10e45639fcd0f23d807920e",
        "tenantId": "d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2",
        "userId": "010177ba-8e02-420c-91a3-e6603f953767",
        "apiVersion": "2",
        "mitigationFlags": [],
        "detail": "queue full route=ops-runtime-test-fair-queue partition=tenant:d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2 routeDepth=3 partitionDepth=3",
        "at": "2026-03-20T17:31:22.621Z"
      },
      {
        "type": "request_queue_rejected",
        "statusCode": 429,
        "method": "POST",
        "route": "/api/ops-runtime-test/fair-queue/hold",
        "requestId": "d8fef817-e9a8-47e0-9ac4-835d61f76d89",
        "traceId": "6ecca6f9569f4f2999dde459d170c6dc",
        "tenantId": "d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2",
        "userId": "010177ba-8e02-420c-91a3-e6603f953767",
        "apiVersion": "2",
        "mitigationFlags": [],
        "detail": "queue full route=ops-runtime-test-fair-queue partition=tenant:d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2 routeDepth=3 partitionDepth=3",
        "at": "2026-03-20T17:31:22.569Z"
      },
      {
        "type": "request_queue_rejected",
        "statusCode": 429,
        "method": "POST",
        "route": "/api/ops-runtime-test/fair-queue/hold",
        "requestId": "09fd829d-c7e9-4564-a260-e1def5b1d71c",
        "traceId": "34fe9df3dc7642a0938d2e1190802761",
        "tenantId": "d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2",
        "userId": "010177ba-8e02-420c-91a3-e6603f953767",
        "apiVersion": "2",
        "mitigationFlags": [],
        "detail": "queue full route=ops-runtime-test-fair-queue partition=tenant:d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2 routeDepth=3 partitionDepth=3",
        "at": "2026-03-20T17:31:22.555Z"
      },
      {
        "type": "request_queued",
        "statusCode": null,
        "method": "POST",
        "route": "/api/ops-runtime-test/fair-queue/hold",
        "requestId": "22a443ca-7f4f-479c-b392-0d8d7cd82141",
        "traceId": "47944a28f5024de38605aab0de9da8c2",
        "tenantId": "d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2",
        "userId": "010177ba-8e02-420c-91a3-e6603f953767",
        "apiVersion": "2",
        "mitigationFlags": [],
        "detail": "queued route=ops-runtime-test-fair-queue partition=tenant:d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2 routeDepth=3 partitionDepth=3",
        "at": "2026-03-20T17:31:22.516Z"
      },
      {
        "type": "circuit_half_open",
        "statusCode": null,
        "method": "GET",
        "route": "/ops-runtime-test/dependency/check",
        "requestId": "136b968d-113a-4634-a475-1c9f51727f77",
        "traceId": "91056029ad9e448d8a947b3046ccf13e",
        "tenantId": "d4f9082b-81f1-4971-973b-5dc03e693399",
        "userId": "9661c781-05b4-438a-b177-736bdfa5767d",
        "apiVersion": "2",
        "mitigationFlags": [],
        "detail": "circuit half-open key=dependency:ops-runtime-test probes=2",
        "at": "2026-03-20T17:31:22.284Z"
      },
      {
        "type": "circuit_open",
        "statusCode": null,
        "method": "GET",
        "route": "/ops-runtime-test/dependency/check",
        "requestId": "17fb23fa-ed8d-4483-99fa-85e600ff9372",
        "traceId": "eb2f7ddbebbf445b88e3ca0655d51ac5",
        "tenantId": "d4f9082b-81f1-4971-973b-5dc03e693399",
        "userId": "9661c781-05b4-438a-b177-736bdfa5767d",
        "apiVersion": "2",
        "mitigationFlags": [],
        "detail": "circuit open key=dependency:ops-runtime-test retryAfterMs=3572",
        "at": "2026-03-20T17:31:17.717Z"
      },
      {
        "type": "auto_mitigation",
        "statusCode": null,
        "method": "UNKNOWN",
        "route": "/system/runtime/load-shedding",
        "requestId": null,
        "traceId": null,
        "tenantId": null,
        "userId": null,
        "apiVersion": null,
        "mitigationFlags": [],
        "detail": "adaptive load shedding factor=1 desired=1 overloadedInstances=0/2",
        "at": "2026-03-20T17:31:14.140Z"
      },
      {
        "type": "request_queued",
        "statusCode": null,
        "method": "POST",
        "route": "/api/ops-runtime-test/fair-queue/hold",
        "requestId": "556288f6-08be-4074-94b3-d3a047f08f0b",
        "traceId": "73e4d4a2920c44d58903b04979ac078c",
        "tenantId": "d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2",
        "userId": "010177ba-8e02-420c-91a3-e6603f953767",
        "apiVersion": "2",
        "mitigationFlags": [],
        "detail": "queued route=ops-runtime-test-fair-queue partition=tenant:d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2 routeDepth=1 partitionDepth=1",
        "at": "2026-03-20T17:31:13.061Z"
      },
      {
        "type": "auto_mitigation",
        "statusCode": null,
        "method": "UNKNOWN",
        "route": "/system/runtime/load-shedding",
        "requestId": null,
        "traceId": null,
        "tenantId": null,
        "userId": null,
        "apiVersion": null,
        "mitigationFlags": [],
        "detail": "adaptive load shedding factor=1 desired=1 overloadedInstances=0/1",
        "at": "2026-03-20T17:31:02.067Z"
      },
      {
        "type": "auto_mitigation",
        "statusCode": null,
        "method": "UNKNOWN",
        "route": "/system/runtime/load-shedding",
        "requestId": null,
        "traceId": null,
        "tenantId": null,
        "userId": null,
        "apiVersion": null,
        "mitigationFlags": [],
        "detail": "adaptive load shedding factor=1 desired=1 overloadedInstances=0/2",
        "at": "2026-03-20T17:31:01.073Z"
      },
      {
        "type": "request_queued",
        "statusCode": null,
        "method": "POST",
        "route": "/api/ops-runtime-test/fair-queue/hold",
        "requestId": "98fb5a7e-74b6-44f8-a0a9-29f2e63f2c47",
        "traceId": "82b698101a074a24b2a842c52268c9f9",
        "tenantId": "298bc3b7-e571-41ea-bd4b-bbba0c37f782",
        "userId": "e445191f-9a2c-47b2-a022-fa35745b6088",
        "apiVersion": "2",
        "mitigationFlags": [],
        "detail": "queued route=ops-runtime-test-fair-queue partition=tenant:298bc3b7-e571-41ea-bd4b-bbba0c37f782 routeDepth=3 partitionDepth=1",
        "at": "2026-03-20T17:31:00.523Z"
      },
      {
        "type": "request_queued",
        "statusCode": null,
        "method": "POST",
        "route": "/api/ops-runtime-test/fair-queue/hold",
        "requestId": "510c1f51-5347-4016-8193-1c39d1c71efc",
        "traceId": "ecd9fd20e2aa48a589f201aeb2a170c8",
        "tenantId": "d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2",
        "userId": "010177ba-8e02-420c-91a3-e6603f953767",
        "apiVersion": "2",
        "mitigationFlags": [],
        "detail": "queued route=ops-runtime-test-fair-queue partition=tenant:d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2 routeDepth=2 partitionDepth=2",
        "at": "2026-03-20T17:31:00.488Z"
      },
      {
        "type": "request_queued",
        "statusCode": null,
        "method": "POST",
        "route": "/api/ops-runtime-test/fair-queue/hold",
        "requestId": "42596078-4088-4b40-ad45-6a1b8f004d7b",
        "traceId": "2bce1799edb64c519a52bf7d62d613f8",
        "tenantId": "d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2",
        "userId": "010177ba-8e02-420c-91a3-e6603f953767",
        "apiVersion": "2",
        "mitigationFlags": [],
        "detail": "queued route=ops-runtime-test-fair-queue partition=tenant:d7ab8fad-ec11-4d48-a6c4-173d5e46e0d2 routeDepth=1 partitionDepth=1",
        "at": "2026-03-20T17:31:00.457Z"
      }
    ]
  },
  "loadShedding": {
    "instanceId": "backend-a",
    "instanceCount": 2,
    "overloadedInstances": 0,
    "adaptiveThrottleFactor": 0.99,
    "desiredAdaptiveThrottleFactor": 1,
    "pressureCause": "normal",
    "stateConsistency": "distributed",
    "local": {
      "eventLoopLagP95Ms": 33.31,
      "eventLoopLagP99Ms": 34.96,
      "eventLoopLagMaxMs": 34.96,
      "eventLoopUtilization": 0.0104,
      "heapUsedRatio": 0.9161,
      "recentApiLatencyMs": 286.24,
      "gcPauseP95Ms": 8.24,
      "gcPauseMaxMs": 20.6,
      "gcEventsRecent": 36,
      "queueDepth": 0,
      "activeIsolatedRequests": 0,
      "pressureScore": 0,
      "consecutiveBreaches": 0,
      "adaptiveThrottleFactor": 1,
      "cause": "normal",
      "overloaded": false
    },
    "clusterRecentApiLatencyMs": 300.12,
    "clusterQueueDepth": 0,
    "mitigation": {
      "degradeHeavyFeatures": false,
      "disableRemoteUpdateChecks": false,
      "rejectHeavyMutations": false,
      "featureFlags": [],
      "businessImpact": []
    }
  },
  "alerts": {
    "instanceId": "backend-a",
    "emitted": [
      "OPS_QUEUE_SATURATION"
    ],
    "skipped": [
      "OPS_HIGH_5XX_ERROR_RATE",
      "OPS_CRITICAL_SLOW_ROUTE",
      "OPS_ACCESS_DENIED_SPIKE",
      "OPS_JOB_FAILURE_STORM",
      "OPS_VERSION_FALLBACK_SPIKE",
      "OPS_REQUEST_RETRY_STORM",
      "OPS_RUNTIME_PRESSURE_RECENT",
      "OPS_CIRCUIT_BREAKER_INSTABILITY",
      "OPS_CORRELATED_OPERATIONAL_DEGRADATION",
      "OPS_DATABASE_DEGRADED",
      "OPS_REDIS_DEGRADED",
      "OPS_FEATURE_MITIGATION_ACTIVE"
    ]
  }
}
```

## simultaneous-failure

- Titulo: Falha simultanea sob carga alta
- Duracao: 6712 ms
- Esperado: Cluster deve degradar de forma controlada, expor mitigacao/alertas e evitar comportamento caotico sob falha combinada.
- Observado:
```json
{
  "queue": {
    "count": 8,
    "avgDurationMs": 1195.75,
    "avgQueueWaitMs": 1088.25,
    "maxQueueWaitMs": 1365,
    "rejected": 0
  },
  "rateLimited": 0,
  "dependencyModes": [
    "failure",
    "failure",
    "failure",
    "failure"
  ],
  "loadShedding": {
    "instanceId": "backend-a",
    "instanceCount": 1,
    "overloadedInstances": 0,
    "adaptiveThrottleFactor": 0.99,
    "desiredAdaptiveThrottleFactor": 1,
    "pressureCause": "normal",
    "stateConsistency": "local_fallback",
    "local": {
      "eventLoopLagP95Ms": 33.46,
      "eventLoopLagP99Ms": 33.78,
      "eventLoopLagMaxMs": 33.78,
      "eventLoopUtilization": 0.1684,
      "heapUsedRatio": 0.9116,
      "recentApiLatencyMs": 236.39,
      "gcPauseP95Ms": 5.95,
      "gcPauseMaxMs": 20.6,
      "gcEventsRecent": 45,
      "queueDepth": 2,
      "activeIsolatedRequests": 1,
      "pressureScore": 0,
      "consecutiveBreaches": 0,
      "adaptiveThrottleFactor": 1,
      "cause": "normal",
      "overloaded": false
    },
    "clusterRecentApiLatencyMs": 236.39,
    "clusterQueueDepth": 2,
    "mitigation": {
      "degradeHeavyFeatures": true,
      "disableRemoteUpdateChecks": false,
      "rejectHeavyMutations": false,
      "featureFlags": [
        "degrade-heavy-features",
        "redis-fallback-visible"
      ],
      "businessImpact": [
        "Widgets pesados do dashboard e agregacoes caras podem operar em modo reduzido.",
        "Coordenacao distribuida esta em fallback local; consistencia global reduzida ate a recuperacao do Redis."
      ]
    }
  },
  "redis": {
    "distributedState": {
      "enabled": true,
      "valid": true,
      "configured": true,
      "mode": "standalone",
      "ready": true,
      "fallbackActive": true,
      "required": false,
      "fallbackMode": "memory",
      "status": "ready",
      "detail": "redis-timeout"
    },
    "lock": {
      "enabled": true,
      "valid": true,
      "configured": true,
      "mode": "standalone",
      "ready": true,
      "fallbackActive": false,
      "required": false,
      "fallbackMode": "memory",
      "status": "ready",
      "detail": null
    }
  },
  "dashboardRuntimeMitigation": {
    "adaptiveThrottleFactor": 0.99,
    "pressureCause": "normal",
    "instanceCount": 1,
    "overloadedInstances": 0,
    "stateConsistency": "local_fallback",
    "clusterRecentApiLatencyMs": 236.39,
    "clusterQueueDepth": 2,
    "degradeHeavyFeatures": true,
    "disableRemoteUpdateChecks": false,
    "rejectHeavyMutations": false,
    "featureFlags": [
      "degrade-heavy-features",
      "redis-fallback-visible"
    ],
    "businessImpact": [
      "Widgets pesados do dashboard e agregacoes caras podem operar em modo reduzido.",
      "Coordenacao distribuida esta em fallback local; consistencia global reduzida ate a recuperacao do Redis."
    ]
  },
  "dashboardRedis": {
    "status": "degraded",
    "error": "Dependencia Redis mitigada automaticamente sob pressao distribuida."
  },
  "alerts": {
    "instanceId": "backend-a",
    "emitted": [],
    "skipped": [
      "OPS_HIGH_5XX_ERROR_RATE",
      "OPS_CRITICAL_SLOW_ROUTE",
      "OPS_ACCESS_DENIED_SPIKE",
      "OPS_JOB_FAILURE_STORM",
      "OPS_VERSION_FALLBACK_SPIKE",
      "OPS_REQUEST_RETRY_STORM",
      "OPS_RUNTIME_PRESSURE_RECENT",
      "OPS_QUEUE_SATURATION",
      "OPS_CIRCUIT_BREAKER_INSTABILITY",
      "OPS_CORRELATED_OPERATIONAL_DEGRADATION",
      "OPS_DATABASE_DEGRADED",
      "OPS_REDIS_DEGRADED",
      "OPS_FEATURE_MITIGATION_ACTIVE"
    ]
  }
}
```

