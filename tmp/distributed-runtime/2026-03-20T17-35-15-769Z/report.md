# Distributed Runtime Proof

Gerado em: 2026-03-20T17:37:06.271Z

## Ambiente

- Instancias backend: backend-a (http://127.0.0.1:4101), backend-b (http://127.0.0.1:4102)
- Redis: Docker + Toxiproxy
- Postgres: Docker
- Dependency stub: host local em 127.0.0.1:4600
- Tenant A: 0e67fec0-45d5-421f-bdb4-317ed62182ee
- Tenant B: 4ff95157-c1d7-4511-bb9c-c483a7720b8d

## fairness-global

- Titulo: Fairness global por tenant
- Duracao: 1293 ms
- Esperado: Tenant B deve receber grants antes de Tenant A consumir toda a fila.
- Observado:
```json
{
  "tenantA": {
    "count": 6,
    "avgDurationMs": 616.83,
    "avgQueueWaitMs": 664.25,
    "maxQueueWaitMs": 1162,
    "rejected": 2
  },
  "tenantB": {
    "count": 3,
    "avgDurationMs": 660.67,
    "avgQueueWaitMs": 541.67,
    "maxQueueWaitMs": 807,
    "rejected": 0
  },
  "orderedStarts": [
    {
      "label": "tenant-a-3",
      "startedAt": "2026-03-20T17:36:01.853Z",
      "tenantId": "0e67fec0-45d5-421f-bdb4-317ed62182ee",
      "instanceId": "backend-a"
    },
    {
      "label": "tenant-b-2",
      "startedAt": "2026-03-20T17:36:02.011Z",
      "tenantId": "4ff95157-c1d7-4511-bb9c-c483a7720b8d",
      "instanceId": "backend-a"
    },
    {
      "label": "tenant-a-1",
      "startedAt": "2026-03-20T17:36:02.190Z",
      "tenantId": "0e67fec0-45d5-421f-bdb4-317ed62182ee",
      "instanceId": "backend-a"
    },
    {
      "label": "tenant-b-3",
      "startedAt": "2026-03-20T17:36:02.372Z",
      "tenantId": "4ff95157-c1d7-4511-bb9c-c483a7720b8d",
      "instanceId": "backend-b"
    },
    {
      "label": "tenant-b-1",
      "startedAt": "2026-03-20T17:36:02.589Z",
      "tenantId": "4ff95157-c1d7-4511-bb9c-c483a7720b8d",
      "instanceId": "backend-b"
    },
    {
      "label": "tenant-a-6",
      "startedAt": "2026-03-20T17:36:02.792Z",
      "tenantId": "0e67fec0-45d5-421f-bdb4-317ed62182ee",
      "instanceId": "backend-b"
    },
    {
      "label": "tenant-a-2",
      "startedAt": "2026-03-20T17:36:02.942Z",
      "tenantId": "0e67fec0-45d5-421f-bdb4-317ed62182ee",
      "instanceId": "backend-b"
    }
  ],
  "tenantBStartedBeforeTenantAExhaustedQueue": true,
  "midFlightQueue": {
    "backendA": {
      "routePolicyId": "ops-runtime-test-fair-queue",
      "active": 0,
      "queued": 5,
      "maxConcurrentRequests": 1,
      "maxConcurrentPerPartition": 1,
      "maxQueueDepth": 6,
      "maxQueueDepthPerPartition": 3,
      "partitions": [
        {
          "partitionKey": "tenant:0e67fec0-45d5-421f-bdb4-317ed62182ee",
          "tenantId": "0e67fec0-45d5-421f-bdb4-317ed62182ee",
          "userId": "3f36f592-8062-4cfb-b3f9-72713256fc18",
          "clientIp": "127.0.0.1",
          "active": 0,
          "queued": 3,
          "grantedCount": 1,
          "lastGrantedAt": "2026-03-20T17:36:01.844Z"
        },
        {
          "partitionKey": "tenant:4ff95157-c1d7-4511-bb9c-c483a7720b8d",
          "tenantId": "4ff95157-c1d7-4511-bb9c-c483a7720b8d",
          "userId": "bb4f3c17-78f6-4c3d-990f-89a3a7e32a86",
          "clientIp": "127.0.0.1",
          "active": 0,
          "queued": 2,
          "grantedCount": 1,
          "lastGrantedAt": "2026-03-20T17:36:02.006Z"
        }
      ]
    },
    "backendB": {
      "routePolicyId": "ops-runtime-test-fair-queue",
      "active": 1,
      "queued": 4,
      "maxConcurrentRequests": 1,
      "maxConcurrentPerPartition": 1,
      "maxQueueDepth": 6,
      "maxQueueDepthPerPartition": 3,
      "partitions": [
        {
          "partitionKey": "tenant:0e67fec0-45d5-421f-bdb4-317ed62182ee",
          "tenantId": "0e67fec0-45d5-421f-bdb4-317ed62182ee",
          "userId": "3f36f592-8062-4cfb-b3f9-72713256fc18",
          "clientIp": "127.0.0.1",
          "active": 1,
          "queued": 2,
          "grantedCount": 2,
          "lastGrantedAt": "2026-03-20T17:36:02.186Z"
        },
        {
          "partitionKey": "tenant:4ff95157-c1d7-4511-bb9c-c483a7720b8d",
          "tenantId": "4ff95157-c1d7-4511-bb9c-c483a7720b8d",
          "userId": "bb4f3c17-78f6-4c3d-990f-89a3a7e32a86",
          "clientIp": "127.0.0.1",
          "active": 0,
          "queued": 2,
          "grantedCount": 1,
          "lastGrantedAt": "2026-03-20T17:36:02.006Z"
        }
      ]
    }
  }
}
```

## redis-unavailable

- Titulo: Redis indisponivel em trafego real
- Duracao: 9363 ms
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
      "sentAt": "2026-03-20T17:36:07.130Z",
      "completedAt": "2026-03-20T17:36:07.270Z",
      "durationMs": 140,
      "queueWaitMs": 27,
      "status": 201,
      "ok": true,
      "headers": {
        "access-control-allow-credentials": "true",
        "access-control-expose-headers": "Content-Type,Content-Length,Content-Encoding,X-Request-Id,X-Trace-Id,Traceparent,Baggage,X-Total-Count,X-API-Version,X-API-Latest-Version,X-API-Supported-Versions,X-API-Deprecated,Deprecation,Sunset,Link,Warning",
        "baggage": "v=2,tid=0e67fec0-45d5-421f-bdb4-317ed62182ee,uid=3f36f592-8062-4cfb-b3f9-72713256fc18,mf=feature_degraded",
        "connection": "keep-alive",
        "content-length": "466",
        "content-security-policy": "default-src 'self';style-src 'self' 'unsafe-inline';script-src 'self';img-src 'self' data: https: blob: http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000;connect-src 'self' http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000 ws://localhost:4000 wss://localhost:4000 ws://localhost:5000 wss://localhost:5000;font-src 'self' data: https://fonts.gstatic.com;object-src 'none';media-src 'self';frame-src 'none';base-uri 'self';form-action 'self';frame-ancestors 'none';script-src-attr 'none';upgrade-insecure-requests",
        "content-type": "application/json; charset=utf-8",
        "cross-origin-embedder-policy": "unsafe-none",
        "cross-origin-opener-policy": "unsafe-none",
        "cross-origin-resource-policy": "cross-origin",
        "date": "Fri, 20 Mar 2026 17:36:07 GMT",
        "etag": "W/\"1d2-o5DL/4u2iQu1txu8y02UwZy4wSY\"",
        "keep-alive": "timeout=5",
        "origin-agent-cluster": "?1",
        "referrer-policy": "strict-origin-when-cross-origin",
        "traceparent": "00-8d85add33f5f45caa686b3c3810b72ca-34b3eb4875a141f6-01",
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
        "x-ratelimit-limit": "9900",
        "x-ratelimit-remaining": "9896",
        "x-ratelimit-reset": "60",
        "x-request-id": "923e5415-7dd3-4e9f-9fed-5f71f7cb1c9c",
        "x-trace-id": "8d85add33f5f45caa686b3c3810b72ca",
        "x-xss-protection": "0"
      },
      "body": {
        "ok": true,
        "operation": "fair-queue-hold",
        "instanceId": "backend-a",
        "tenantId": "0e67fec0-45d5-421f-bdb4-317ed62182ee",
        "userId": "3f36f592-8062-4cfb-b3f9-72713256fc18",
        "configuredDelayMs": 100,
        "startedAt": "2026-03-20T17:36:07.157Z",
        "completedAt": "2026-03-20T17:36:07.267Z",
        "durationMs": 110,
        "trace": {
          "requestId": "923e5415-7dd3-4e9f-9fed-5f71f7cb1c9c",
          "traceId": "8d85add33f5f45caa686b3c3810b72ca",
          "apiVersion": "2",
          "mitigationFlags": [
            "feature_degraded"
          ],
          "baggageBytes": 105
        }
      }
    },
    {
      "label": "tenant-a-down-b",
      "baseUrl": "http://127.0.0.1:4102",
      "routePath": "/api/ops-runtime-test/fair-queue/hold?holdMs=1200",
      "sentAt": "2026-03-20T17:36:07.131Z",
      "completedAt": "2026-03-20T17:36:07.269Z",
      "durationMs": 138,
      "queueWaitMs": 24,
      "status": 201,
      "ok": true,
      "headers": {
        "access-control-allow-credentials": "true",
        "access-control-expose-headers": "Content-Type,Content-Length,Content-Encoding,X-Request-Id,X-Trace-Id,Traceparent,Baggage,X-Total-Count,X-API-Version,X-API-Latest-Version,X-API-Supported-Versions,X-API-Deprecated,Deprecation,Sunset,Link,Warning",
        "baggage": "v=2,tid=0e67fec0-45d5-421f-bdb4-317ed62182ee,uid=3f36f592-8062-4cfb-b3f9-72713256fc18",
        "connection": "keep-alive",
        "content-length": "447",
        "content-security-policy": "default-src 'self';style-src 'self' 'unsafe-inline';script-src 'self';img-src 'self' data: https: blob: http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000;connect-src 'self' http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000 ws://localhost:4000 wss://localhost:4000 ws://localhost:5000 wss://localhost:5000;font-src 'self' data: https://fonts.gstatic.com;object-src 'none';media-src 'self';frame-src 'none';base-uri 'self';form-action 'self';frame-ancestors 'none';script-src-attr 'none';upgrade-insecure-requests",
        "content-type": "application/json; charset=utf-8",
        "cross-origin-embedder-policy": "unsafe-none",
        "cross-origin-opener-policy": "unsafe-none",
        "cross-origin-resource-policy": "cross-origin",
        "date": "Fri, 20 Mar 2026 17:36:07 GMT",
        "etag": "W/\"1bf-QOjf0shedp0XtvC/0WSEDXALdHg\"",
        "keep-alive": "timeout=5",
        "origin-agent-cluster": "?1",
        "referrer-policy": "strict-origin-when-cross-origin",
        "traceparent": "00-a062856922d14dce88196ddb2ca537be-7db1b1a9c61d48ab-01",
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
        "x-ratelimit-limit": "10000",
        "x-ratelimit-remaining": "9995",
        "x-ratelimit-reset": "55",
        "x-request-id": "15f56c2f-114a-411c-9baf-694e62ef1b29",
        "x-trace-id": "a062856922d14dce88196ddb2ca537be",
        "x-xss-protection": "0"
      },
      "body": {
        "ok": true,
        "operation": "fair-queue-hold",
        "instanceId": "backend-b",
        "tenantId": "0e67fec0-45d5-421f-bdb4-317ed62182ee",
        "userId": "3f36f592-8062-4cfb-b3f9-72713256fc18",
        "configuredDelayMs": 100,
        "startedAt": "2026-03-20T17:36:07.155Z",
        "completedAt": "2026-03-20T17:36:07.266Z",
        "durationMs": 111,
        "trace": {
          "requestId": "15f56c2f-114a-411c-9baf-694e62ef1b29",
          "traceId": "a062856922d14dce88196ddb2ca537be",
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
- Duracao: 6434 ms
- Esperado: Health snapshot e payload operacional devem refletir latencia/falha Redis com degradacao explicita.
- Observado:
```json
{
  "traffic": [
    {
      "label": "intermittent-1",
      "baseUrl": "http://127.0.0.1:4101",
      "routePath": "/api/ops-runtime-test/fair-queue/hold?holdMs=700",
      "sentAt": "2026-03-20T17:36:14.462Z",
      "completedAt": "2026-03-20T17:36:14.613Z",
      "durationMs": 151,
      "queueWaitMs": 42,
      "status": 201,
      "ok": true,
      "headers": {
        "access-control-allow-credentials": "true",
        "access-control-expose-headers": "Content-Type,Content-Length,Content-Encoding,X-Request-Id,X-Trace-Id,Traceparent,Baggage,X-Total-Count,X-API-Version,X-API-Latest-Version,X-API-Supported-Versions,X-API-Deprecated,Deprecation,Sunset,Link,Warning",
        "baggage": "v=2,tid=0e67fec0-45d5-421f-bdb4-317ed62182ee,uid=3f36f592-8062-4cfb-b3f9-72713256fc18,mf=feature_degraded",
        "connection": "keep-alive",
        "content-length": "466",
        "content-security-policy": "default-src 'self';style-src 'self' 'unsafe-inline';script-src 'self';img-src 'self' data: https: blob: http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000;connect-src 'self' http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000 ws://localhost:4000 wss://localhost:4000 ws://localhost:5000 wss://localhost:5000;font-src 'self' data: https://fonts.gstatic.com;object-src 'none';media-src 'self';frame-src 'none';base-uri 'self';form-action 'self';frame-ancestors 'none';script-src-attr 'none';upgrade-insecure-requests",
        "content-type": "application/json; charset=utf-8",
        "cross-origin-embedder-policy": "unsafe-none",
        "cross-origin-opener-policy": "unsafe-none",
        "cross-origin-resource-policy": "cross-origin",
        "date": "Fri, 20 Mar 2026 17:36:14 GMT",
        "etag": "W/\"1d2-HYHUhAM2CkV8kxJcGM4eFivefIU\"",
        "keep-alive": "timeout=5",
        "origin-agent-cluster": "?1",
        "referrer-policy": "strict-origin-when-cross-origin",
        "traceparent": "00-124a9b8e59474cfc97b2aebe97a0d606-4a376e65258f4399-01",
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
        "x-ratelimit-limit": "9900",
        "x-ratelimit-remaining": "9895",
        "x-ratelimit-reset": "53",
        "x-request-id": "466e47f4-6f31-4ce7-b513-ff2b44567470",
        "x-trace-id": "124a9b8e59474cfc97b2aebe97a0d606",
        "x-xss-protection": "0"
      },
      "body": {
        "ok": true,
        "operation": "fair-queue-hold",
        "instanceId": "backend-a",
        "tenantId": "0e67fec0-45d5-421f-bdb4-317ed62182ee",
        "userId": "3f36f592-8062-4cfb-b3f9-72713256fc18",
        "configuredDelayMs": 100,
        "startedAt": "2026-03-20T17:36:14.504Z",
        "completedAt": "2026-03-20T17:36:14.610Z",
        "durationMs": 106,
        "trace": {
          "requestId": "466e47f4-6f31-4ce7-b513-ff2b44567470",
          "traceId": "124a9b8e59474cfc97b2aebe97a0d606",
          "apiVersion": "2",
          "mitigationFlags": [
            "feature_degraded"
          ],
          "baggageBytes": 105
        }
      }
    },
    {
      "label": "intermittent-2",
      "baseUrl": "http://127.0.0.1:4102",
      "routePath": "/api/ops-runtime-test/fair-queue/hold?holdMs=700",
      "sentAt": "2026-03-20T17:36:14.463Z",
      "completedAt": "2026-03-20T17:36:14.738Z",
      "durationMs": 275,
      "queueWaitMs": 170,
      "status": 201,
      "ok": true,
      "headers": {
        "access-control-allow-credentials": "true",
        "access-control-expose-headers": "Content-Type,Content-Length,Content-Encoding,X-Request-Id,X-Trace-Id,Traceparent,Baggage,X-Total-Count,X-API-Version,X-API-Latest-Version,X-API-Supported-Versions,X-API-Deprecated,Deprecation,Sunset,Link,Warning",
        "baggage": "v=2,tid=0e67fec0-45d5-421f-bdb4-317ed62182ee,uid=3f36f592-8062-4cfb-b3f9-72713256fc18",
        "connection": "keep-alive",
        "content-length": "447",
        "content-security-policy": "default-src 'self';style-src 'self' 'unsafe-inline';script-src 'self';img-src 'self' data: https: blob: http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000;connect-src 'self' http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000 ws://localhost:4000 wss://localhost:4000 ws://localhost:5000 wss://localhost:5000;font-src 'self' data: https://fonts.gstatic.com;object-src 'none';media-src 'self';frame-src 'none';base-uri 'self';form-action 'self';frame-ancestors 'none';script-src-attr 'none';upgrade-insecure-requests",
        "content-type": "application/json; charset=utf-8",
        "cross-origin-embedder-policy": "unsafe-none",
        "cross-origin-opener-policy": "unsafe-none",
        "cross-origin-resource-policy": "cross-origin",
        "date": "Fri, 20 Mar 2026 17:36:14 GMT",
        "etag": "W/\"1bf-FIKe+3Y8mvwAXReiarobD2bLiBE\"",
        "keep-alive": "timeout=5",
        "origin-agent-cluster": "?1",
        "referrer-policy": "strict-origin-when-cross-origin",
        "traceparent": "00-2040eb75cb354158b23687b18ebae27c-40977cc636c043d3-01",
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
        "x-ratelimit-limit": "10000",
        "x-ratelimit-remaining": "9994",
        "x-ratelimit-reset": "48",
        "x-request-id": "93ec6611-7837-4133-89f6-8becb749e1a8",
        "x-trace-id": "2040eb75cb354158b23687b18ebae27c",
        "x-xss-protection": "0"
      },
      "body": {
        "ok": true,
        "operation": "fair-queue-hold",
        "instanceId": "backend-b",
        "tenantId": "0e67fec0-45d5-421f-bdb4-317ed62182ee",
        "userId": "3f36f592-8062-4cfb-b3f9-72713256fc18",
        "configuredDelayMs": 100,
        "startedAt": "2026-03-20T17:36:14.633Z",
        "completedAt": "2026-03-20T17:36:14.735Z",
        "durationMs": 102,
        "trace": {
          "requestId": "93ec6611-7837-4133-89f6-8becb749e1a8",
          "traceId": "2040eb75cb354158b23687b18ebae27c",
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
      "sentAt": "2026-03-20T17:36:14.463Z",
      "completedAt": "2026-03-20T17:36:14.739Z",
      "durationMs": 276,
      "queueWaitMs": 169,
      "status": 201,
      "ok": true,
      "headers": {
        "access-control-allow-credentials": "true",
        "access-control-expose-headers": "Content-Type,Content-Length,Content-Encoding,X-Request-Id,X-Trace-Id,Traceparent,Baggage,X-Total-Count,X-API-Version,X-API-Latest-Version,X-API-Supported-Versions,X-API-Deprecated,Deprecation,Sunset,Link,Warning",
        "baggage": "v=2,tid=0e67fec0-45d5-421f-bdb4-317ed62182ee,uid=3f36f592-8062-4cfb-b3f9-72713256fc18,mf=feature_degraded",
        "connection": "keep-alive",
        "content-length": "466",
        "content-security-policy": "default-src 'self';style-src 'self' 'unsafe-inline';script-src 'self';img-src 'self' data: https: blob: http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000;connect-src 'self' http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000 ws://localhost:4000 wss://localhost:4000 ws://localhost:5000 wss://localhost:5000;font-src 'self' data: https://fonts.gstatic.com;object-src 'none';media-src 'self';frame-src 'none';base-uri 'self';form-action 'self';frame-ancestors 'none';script-src-attr 'none';upgrade-insecure-requests",
        "content-type": "application/json; charset=utf-8",
        "cross-origin-embedder-policy": "unsafe-none",
        "cross-origin-opener-policy": "unsafe-none",
        "cross-origin-resource-policy": "cross-origin",
        "date": "Fri, 20 Mar 2026 17:36:14 GMT",
        "etag": "W/\"1d2-LskRahnT9eAOt6N4+nOhFfaogQE\"",
        "keep-alive": "timeout=5",
        "origin-agent-cluster": "?1",
        "referrer-policy": "strict-origin-when-cross-origin",
        "traceparent": "00-1906ff3482b744f19942a6ef4a268632-44d647b6ad6d4c30-01",
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
        "x-ratelimit-limit": "9900",
        "x-ratelimit-remaining": "9894",
        "x-ratelimit-reset": "53",
        "x-request-id": "9ab86af0-ef8a-4988-8f99-2304952135e5",
        "x-trace-id": "1906ff3482b744f19942a6ef4a268632",
        "x-xss-protection": "0"
      },
      "body": {
        "ok": true,
        "operation": "fair-queue-hold",
        "instanceId": "backend-a",
        "tenantId": "0e67fec0-45d5-421f-bdb4-317ed62182ee",
        "userId": "3f36f592-8062-4cfb-b3f9-72713256fc18",
        "configuredDelayMs": 100,
        "startedAt": "2026-03-20T17:36:14.632Z",
        "completedAt": "2026-03-20T17:36:14.735Z",
        "durationMs": 103,
        "trace": {
          "requestId": "9ab86af0-ef8a-4988-8f99-2304952135e5",
          "traceId": "1906ff3482b744f19942a6ef4a268632",
          "apiVersion": "2",
          "mitigationFlags": [
            "feature_degraded"
          ],
          "baggageBytes": 105
        }
      }
    },
    {
      "label": "intermittent-4",
      "baseUrl": "http://127.0.0.1:4102",
      "routePath": "/api/ops-runtime-test/fair-queue/hold?holdMs=700",
      "sentAt": "2026-03-20T17:36:14.463Z",
      "completedAt": "2026-03-20T17:36:14.614Z",
      "durationMs": 151,
      "queueWaitMs": 37,
      "status": 201,
      "ok": true,
      "headers": {
        "access-control-allow-credentials": "true",
        "access-control-expose-headers": "Content-Type,Content-Length,Content-Encoding,X-Request-Id,X-Trace-Id,Traceparent,Baggage,X-Total-Count,X-API-Version,X-API-Latest-Version,X-API-Supported-Versions,X-API-Deprecated,Deprecation,Sunset,Link,Warning",
        "baggage": "v=2,tid=0e67fec0-45d5-421f-bdb4-317ed62182ee,uid=3f36f592-8062-4cfb-b3f9-72713256fc18",
        "connection": "keep-alive",
        "content-length": "447",
        "content-security-policy": "default-src 'self';style-src 'self' 'unsafe-inline';script-src 'self';img-src 'self' data: https: blob: http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000;connect-src 'self' http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000 ws://localhost:4000 wss://localhost:4000 ws://localhost:5000 wss://localhost:5000;font-src 'self' data: https://fonts.gstatic.com;object-src 'none';media-src 'self';frame-src 'none';base-uri 'self';form-action 'self';frame-ancestors 'none';script-src-attr 'none';upgrade-insecure-requests",
        "content-type": "application/json; charset=utf-8",
        "cross-origin-embedder-policy": "unsafe-none",
        "cross-origin-opener-policy": "unsafe-none",
        "cross-origin-resource-policy": "cross-origin",
        "date": "Fri, 20 Mar 2026 17:36:14 GMT",
        "etag": "W/\"1bf-1jGqC6VLXCwgcEbB4kkTTppgKE0\"",
        "keep-alive": "timeout=5",
        "origin-agent-cluster": "?1",
        "referrer-policy": "strict-origin-when-cross-origin",
        "traceparent": "00-c541d28e66134efcb936e91ac7fa7e50-bb46af7a37474f27-01",
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
        "x-ratelimit-limit": "10000",
        "x-ratelimit-remaining": "9993",
        "x-ratelimit-reset": "48",
        "x-request-id": "d704830c-6a90-46c1-bc76-21c75112b846",
        "x-trace-id": "c541d28e66134efcb936e91ac7fa7e50",
        "x-xss-protection": "0"
      },
      "body": {
        "ok": true,
        "operation": "fair-queue-hold",
        "instanceId": "backend-b",
        "tenantId": "0e67fec0-45d5-421f-bdb4-317ed62182ee",
        "userId": "3f36f592-8062-4cfb-b3f9-72713256fc18",
        "configuredDelayMs": 100,
        "startedAt": "2026-03-20T17:36:14.500Z",
        "completedAt": "2026-03-20T17:36:14.610Z",
        "durationMs": 110,
        "trace": {
          "requestId": "d704830c-6a90-46c1-bc76-21c75112b846",
          "traceId": "c541d28e66134efcb936e91ac7fa7e50",
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
- Duracao: 5032 ms
- Esperado: Uma falha isolada nao deve abrir circuito; duas instancias votando devem abrir, half-open deve permitir probes limitados e recuperar gradualmente.
- Observado:
```json
{
  "firstFailure": {
    "ok": false,
    "statusCode": 502,
    "mode": "failure",
    "instanceId": "backend-a",
    "durationMs": 81,
    "tenantId": "cfea578a-1b9b-4999-9722-f213833e9846",
    "trace": {
      "requestId": "da78cda1-10e5-4ded-a0d6-244a0eeff68b",
      "traceId": "9fa6fd7b77bc4efebbfe0ded266d252b",
      "apiVersion": "2",
      "mitigationFlags": [
        "feature_degraded"
      ],
      "baggageBytes": 105
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
      "lastTransitionAt": 1774028178937,
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
    "tenantId": "cfea578a-1b9b-4999-9722-f213833e9846",
    "trace": {
      "requestId": "b0ab9ae5-d86a-40c6-8bbe-d7884ed7b1b7",
      "traceId": "6e7e1c69adb64b3db574fb811d3420e6",
      "apiVersion": "2",
      "mitigationFlags": [],
      "baggageBytes": 85
    },
    "breaker": {
      "key": "dependency:ops-runtime-test",
      "mode": "open",
      "failures": 2,
      "openCount": 1,
      "openedUntil": 1774028183423,
      "halfOpenInFlight": 0,
      "halfOpenProbeAttempts": 0,
      "halfOpenSuccesses": 0,
      "consecutiveSuccesses": 0,
      "lastTransitionAt": 1774028179149,
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
    "durationMs": 10,
    "tenantId": "cfea578a-1b9b-4999-9722-f213833e9846",
    "trace": {
      "requestId": "edb32510-0fe1-4109-b0de-ca1769126c65",
      "traceId": "c61a5323fa71457d9b0717158d595072",
      "apiVersion": "2",
      "mitigationFlags": [
        "feature_degraded"
      ],
      "baggageBytes": 105
    },
    "breaker": {
      "key": "dependency:ops-runtime-test",
      "mode": "open",
      "failures": 2,
      "openCount": 1,
      "openedUntil": 1774028183423,
      "halfOpenInFlight": 0,
      "halfOpenProbeAttempts": 0,
      "halfOpenSuccesses": 0,
      "consecutiveSuccesses": 0,
      "lastTransitionAt": 1774028179149,
      "failureVoters": 2,
      "recoveryVoters": 0
    },
    "error": {
      "message": "Circuit breaker aberto para dependency:ops-runtime-test",
      "retryAfterMs": 4229
    }
  },
  "recoveryProbeA": {
    "ok": true,
    "statusCode": 200,
    "mode": "ok",
    "instanceId": "backend-a",
    "durationMs": 28,
    "tenantId": "cfea578a-1b9b-4999-9722-f213833e9846",
    "trace": {
      "requestId": "1ee0e33b-e9db-4c2a-9741-05047b921c1c",
      "traceId": "f95ebdab048c471d843796ece35831a7",
      "apiVersion": "2",
      "mitigationFlags": [
        "feature_degraded"
      ],
      "baggageBytes": 105
    },
    "breaker": {
      "key": "dependency:ops-runtime-test",
      "mode": "half-open",
      "failures": 2,
      "openCount": 1,
      "openedUntil": 1774028183423,
      "halfOpenInFlight": 0,
      "halfOpenProbeAttempts": 1,
      "halfOpenSuccesses": 1,
      "consecutiveSuccesses": 1,
      "lastTransitionAt": 1774028183752,
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
        "x-request-id": "1ee0e33b-e9db-4c2a-9741-05047b921c1c",
        "x-trace-id": "f95ebdab048c471d843796ece35831a7",
        "traceparent": "00-f95ebdab048c471d843796ece35831a7-68cf5a763f4941e3-01",
        "baggage": "v=2,tid=cfea578a-1b9b-4999-9722-f213833e9846,uid=1cb56205-ab6f-44f3-bad0-48b6e909c915,mf=feature_degraded"
      }
    }
  },
  "recoveryProbeB": {
    "ok": true,
    "statusCode": 200,
    "mode": "ok",
    "instanceId": "backend-b",
    "durationMs": 27,
    "tenantId": "cfea578a-1b9b-4999-9722-f213833e9846",
    "trace": {
      "requestId": "08fdff31-7551-4154-9255-fc596bad2699",
      "traceId": "f57a686b134640e7a3d3ce4282271083",
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
      "lastTransitionAt": 1774028183834,
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
        "x-request-id": "08fdff31-7551-4154-9255-fc596bad2699",
        "x-trace-id": "f57a686b134640e7a3d3ce4282271083",
        "traceparent": "00-f57a686b134640e7a3d3ce4282271083-b41b2e51357e47de-01",
        "baggage": "v=2,tid=cfea578a-1b9b-4999-9722-f213833e9846,uid=1cb56205-ab6f-44f3-bad0-48b6e909c915"
      }
    }
  },
  "recovered": {
    "ok": true,
    "statusCode": 200,
    "mode": "ok",
    "instanceId": "backend-a",
    "durationMs": 21,
    "tenantId": "cfea578a-1b9b-4999-9722-f213833e9846",
    "trace": {
      "requestId": "1d0b2f08-5d3a-4011-a323-17a494f03277",
      "traceId": "03d59844599a4036bc4c62ed311de978",
      "apiVersion": "2",
      "mitigationFlags": [
        "feature_degraded"
      ],
      "baggageBytes": 105
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
      "lastTransitionAt": 1774028183893,
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
        "x-request-id": "1d0b2f08-5d3a-4011-a323-17a494f03277",
        "x-trace-id": "03d59844599a4036bc4c62ed311de978",
        "traceparent": "00-03d59844599a4036bc4c62ed311de978-1a737649cccd4039-01",
        "baggage": "v=2,tid=cfea578a-1b9b-4999-9722-f213833e9846,uid=1cb56205-ab6f-44f3-bad0-48b6e909c915,mf=feature_degraded"
      }
    }
  }
}
```

## granular-shedding

- Titulo: Shedding granular por tenant e rota
- Duracao: 1621 ms
- Esperado: Tenant pesado deve receber factor reduzido e causa tenant-route, enquanto tenant leve permanece sem penalizacao injusta.
- Observado:
```json
{
  "hammer": {
    "total": 10,
    "blocked": 6,
    "avgQueueWaitMs": 358.5,
    "maxQueueWaitMs": 671
  },
  "tenantAContext": {
    "instanceId": "backend-a",
    "tenantId": "0e67fec0-45d5-421f-bdb4-317ed62182ee",
    "path": "/api/ops-runtime-test/fair-queue/hold",
    "trace": {
      "requestId": "88d1b65e-1385-4768-8d68-2894a35053b0",
      "traceId": "1e94f18d0b4e4df1b344bcf9524bf6be",
      "apiVersion": "2",
      "mitigationFlags": [
        "feature_degraded"
      ],
      "baggageBytes": 105
    },
    "factor": 0.55,
    "cause": "tenant-route:ops-runtime-test-fair-queue",
    "scope": "tenant-route",
    "signalScore": 18,
    "snapshot": {
      "instanceId": "backend-a",
      "instanceCount": 2,
      "overloadedInstances": 0,
      "adaptiveThrottleFactor": 0.99,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "stateConsistency": "distributed",
      "local": {
        "eventLoopLagP95Ms": 33.59,
        "eventLoopLagP99Ms": 34.8,
        "eventLoopLagMaxMs": 34.8,
        "eventLoopUtilization": 0.1129,
        "heapUsedRatio": 0.8998,
        "recentApiLatencyMs": 125.2,
        "gcPauseP95Ms": 10.27,
        "gcPauseMaxMs": 13.87,
        "gcEventsRecent": 24,
        "queueDepth": 0,
        "activeIsolatedRequests": 0,
        "pressureScore": 0,
        "consecutiveBreaches": 0,
        "adaptiveThrottleFactor": 1,
        "cause": "normal",
        "overloaded": false
      },
      "clusterRecentApiLatencyMs": 218.34,
      "clusterQueueDepth": 0,
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
    "tenantId": "4ff95157-c1d7-4511-bb9c-c483a7720b8d",
    "path": "/api/ops-runtime-test/fair-queue/hold",
    "trace": {
      "requestId": "f2a5966a-9d76-47d6-ba25-1a2502709522",
      "traceId": "a1ab6c3206824af8af2c71283de17fa8",
      "apiVersion": "2",
      "mitigationFlags": [
        "feature_degraded"
      ],
      "baggageBytes": 105
    },
    "factor": 0.99,
    "cause": "normal",
    "scope": "cluster",
    "signalScore": 0,
    "snapshot": {
      "instanceId": "backend-a",
      "instanceCount": 2,
      "overloadedInstances": 0,
      "adaptiveThrottleFactor": 0.99,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "stateConsistency": "distributed",
      "local": {
        "eventLoopLagP95Ms": 33.59,
        "eventLoopLagP99Ms": 34.8,
        "eventLoopLagMaxMs": 34.8,
        "eventLoopUtilization": 0.1129,
        "heapUsedRatio": 0.8998,
        "recentApiLatencyMs": 125.2,
        "gcPauseP95Ms": 10.27,
        "gcPauseMaxMs": 13.87,
        "gcEventsRecent": 24,
        "queueDepth": 0,
        "activeIsolatedRequests": 0,
        "pressureScore": 0,
        "consecutiveBreaches": 0,
        "adaptiveThrottleFactor": 1,
        "cause": "normal",
        "overloaded": false
      },
      "clusterRecentApiLatencyMs": 218.34,
      "clusterQueueDepth": 0,
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
- Duracao: 12803 ms
- Esperado: Adaptive factor deve cair com suavizacao, nao oscilar agressivamente e recuperar de forma gradual apos estabilidade.
- Observado:
```json
{
  "underLoadSamples": [
    {
      "at": "2026-03-20T17:36:25.825Z",
      "adaptiveThrottleFactor": 0.88,
      "desiredAdaptiveThrottleFactor": 0.75,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 222.94,
      "clusterQueueDepth": 6,
      "featureFlags": [
        "degrade-heavy-features"
      ]
    },
    {
      "at": "2026-03-20T17:36:26.864Z",
      "adaptiveThrottleFactor": 0.88,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 210.67,
      "clusterQueueDepth": 1,
      "featureFlags": []
    },
    {
      "at": "2026-03-20T17:36:27.902Z",
      "adaptiveThrottleFactor": 0.88,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 201.41,
      "clusterQueueDepth": 0,
      "featureFlags": []
    },
    {
      "at": "2026-03-20T17:36:28.946Z",
      "adaptiveThrottleFactor": 0.93,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 192.91,
      "clusterQueueDepth": 0,
      "featureFlags": []
    },
    {
      "at": "2026-03-20T17:36:30.026Z",
      "adaptiveThrottleFactor": 0.98,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 191.62,
      "clusterQueueDepth": 0,
      "featureFlags": []
    },
    {
      "at": "2026-03-20T17:36:31.079Z",
      "adaptiveThrottleFactor": 1,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 190.39,
      "clusterQueueDepth": 0,
      "featureFlags": []
    }
  ],
  "recoverySamples": [
    {
      "at": "2026-03-20T17:36:32.134Z",
      "adaptiveThrottleFactor": 1,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 189.21,
      "clusterQueueDepth": 0,
      "featureFlags": []
    },
    {
      "at": "2026-03-20T17:36:33.198Z",
      "adaptiveThrottleFactor": 1,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 188.11,
      "clusterQueueDepth": 0,
      "featureFlags": []
    },
    {
      "at": "2026-03-20T17:36:34.251Z",
      "adaptiveThrottleFactor": 1,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 187.08,
      "clusterQueueDepth": 0,
      "featureFlags": []
    },
    {
      "at": "2026-03-20T17:36:35.307Z",
      "adaptiveThrottleFactor": 1,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 186.05,
      "clusterQueueDepth": 0,
      "featureFlags": []
    },
    {
      "at": "2026-03-20T17:36:36.358Z",
      "adaptiveThrottleFactor": 1,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 185.09,
      "clusterQueueDepth": 0,
      "featureFlags": []
    }
  ],
  "underLoadRateLimitBodies": [
    {
      "at": "2026-03-20T17:36:25.817Z",
      "status": 200,
      "adaptiveFactor": 0.88,
      "pressureCause": "normal",
      "routePolicyId": "ops-runtime-test-rate-limit"
    },
    {
      "at": "2026-03-20T17:36:26.322Z",
      "status": 200,
      "adaptiveFactor": 1,
      "pressureCause": null,
      "routePolicyId": "ops-runtime-test-rate-limit"
    },
    {
      "at": "2026-03-20T17:36:26.823Z",
      "status": 200,
      "adaptiveFactor": 0.88,
      "pressureCause": "normal",
      "routePolicyId": "ops-runtime-test-rate-limit"
    },
    {
      "at": "2026-03-20T17:36:27.320Z",
      "status": 200,
      "adaptiveFactor": 1,
      "pressureCause": null,
      "routePolicyId": "ops-runtime-test-rate-limit"
    },
    {
      "at": "2026-03-20T17:36:27.817Z",
      "status": 200,
      "adaptiveFactor": 0.88,
      "pressureCause": "normal",
      "routePolicyId": "ops-runtime-test-rate-limit"
    },
    {
      "at": "2026-03-20T17:36:28.318Z",
      "status": 200,
      "adaptiveFactor": 1,
      "pressureCause": null,
      "routePolicyId": "ops-runtime-test-rate-limit"
    }
  ],
  "recoveryRateLimitBodies": [
    {
      "at": "2026-03-20T17:36:37.396Z",
      "status": 200,
      "adaptiveFactor": 1,
      "pressureCause": null,
      "routePolicyId": "ops-runtime-test-rate-limit"
    },
    {
      "at": "2026-03-20T17:36:37.701Z",
      "status": 200,
      "adaptiveFactor": 1,
      "pressureCause": null,
      "routePolicyId": "ops-runtime-test-rate-limit"
    },
    {
      "at": "2026-03-20T17:36:38.016Z",
      "status": 200,
      "adaptiveFactor": 1,
      "pressureCause": null,
      "routePolicyId": "ops-runtime-test-rate-limit"
    },
    {
      "at": "2026-03-20T17:36:38.324Z",
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
- Duracao: 3437 ms
- Esperado: Traceparent e baggage devem ser propagados com tenantId, userId, apiVersion e flags sem ultrapassar o limite configurado.
- Observado:
```json
{
  "dependencyResponse": {
    "ok": true,
    "statusCode": 200,
    "mode": "ok",
    "instanceId": "backend-a",
    "durationMs": 31,
    "tenantId": "0e67fec0-45d5-421f-bdb4-317ed62182ee",
    "trace": {
      "requestId": "03cedba1-bbc3-45cc-8e08-626ecff664b7",
      "traceId": "4842bfc172684a2f8d643568e16ec6bd",
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
      "lastTransitionAt": 1774028201752,
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
        "x-request-id": "03cedba1-bbc3-45cc-8e08-626ecff664b7",
        "x-trace-id": "4842bfc172684a2f8d643568e16ec6bd",
        "traceparent": "00-4842bfc172684a2f8d643568e16ec6bd-c49e61045c9845b6-01",
        "baggage": "v=2,tid=0e67fec0-45d5-421f-bdb4-317ed62182ee,uid=3f36f592-8062-4cfb-b3f9-72713256fc18"
      }
    }
  },
  "stubObserved": {
    "at": "2026-03-20T17:36:41.744Z",
    "method": "GET",
    "path": "/dependency",
    "traceparent": "00-4842bfc172684a2f8d643568e16ec6bd-c49e61045c9845b6-01",
    "baggage": "v=2,tid=0e67fec0-45d5-421f-bdb4-317ed62182ee,uid=3f36f592-8062-4cfb-b3f9-72713256fc18",
    "baggageBytes": 85,
    "requestId": "03cedba1-bbc3-45cc-8e08-626ecff664b7",
    "traceId": "4842bfc172684a2f8d643568e16ec6bd"
  },
  "baggageUnderControl": true
}
```

## slow-success

- Titulo: Sucesso lento com visibilidade operacional
- Duracao: 3181 ms
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
    "windowStart": "2026-03-20T17:21:44.865Z",
    "windowSeconds": 900,
    "totalEventsRecent": 28,
    "byType": [
      {
        "type": "auto_mitigation",
        "count": 13
      },
      {
        "type": "request_queue_rejected",
        "count": 9
      },
      {
        "type": "request_queued",
        "count": 4
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
        "count": 13
      },
      {
        "route": "/system/runtime/load-shedding",
        "count": 13
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
        "detail": "adaptive load shedding factor=1 desired=1 overloadedInstances=0/2",
        "at": "2026-03-20T17:36:30.792Z"
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
        "detail": "adaptive load shedding factor=0.98 desired=1 overloadedInstances=0/2",
        "at": "2026-03-20T17:36:29.792Z"
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
        "detail": "adaptive load shedding factor=0.93 desired=1 overloadedInstances=0/2",
        "at": "2026-03-20T17:36:28.789Z"
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
        "detail": "adaptive load shedding factor=0.88 desired=1 overloadedInstances=0/2",
        "at": "2026-03-20T17:36:26.782Z"
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
        "detail": "adaptive load shedding factor=0.88 desired=0.75 overloadedInstances=0/2",
        "at": "2026-03-20T17:36:25.765Z"
      },
      {
        "type": "request_queue_rejected",
        "statusCode": 429,
        "method": "POST",
        "route": "/api/ops-runtime-test/fair-queue/hold",
        "requestId": "916f9d84-ef3c-4fa4-a4f6-82668b790d53",
        "traceId": "47cad5dcf73343478f5d25f79a81fa4f",
        "tenantId": "0e67fec0-45d5-421f-bdb4-317ed62182ee",
        "userId": "3f36f592-8062-4cfb-b3f9-72713256fc18",
        "apiVersion": "2",
        "mitigationFlags": [
          "feature_degraded"
        ],
        "detail": "queue full route=ops-runtime-test-fair-queue partition=tenant:0e67fec0-45d5-421f-bdb4-317ed62182ee routeDepth=3 partitionDepth=3",
        "at": "2026-03-20T17:36:25.707Z"
      },
      {
        "type": "request_queue_rejected",
        "statusCode": 429,
        "method": "POST",
        "route": "/api/ops-runtime-test/fair-queue/hold",
        "requestId": "774914ea-40ff-493e-8d2e-73ebbf6cad5d",
        "traceId": "39d18c7c41ea4b22bc9c2a030ad384b6",
        "tenantId": "0e67fec0-45d5-421f-bdb4-317ed62182ee",
        "userId": "3f36f592-8062-4cfb-b3f9-72713256fc18",
        "apiVersion": "2",
        "mitigationFlags": [
          "feature_degraded"
        ],
        "detail": "queue full route=ops-runtime-test-fair-queue partition=tenant:0e67fec0-45d5-421f-bdb4-317ed62182ee routeDepth=3 partitionDepth=3",
        "at": "2026-03-20T17:36:25.675Z"
      },
      {
        "type": "request_queue_rejected",
        "statusCode": 429,
        "method": "POST",
        "route": "/api/ops-runtime-test/fair-queue/hold",
        "requestId": "60cc79e0-9a35-4e43-9df7-6b8888e51538",
        "traceId": "f492610edc5a433590a59dfc140487aa",
        "tenantId": "0e67fec0-45d5-421f-bdb4-317ed62182ee",
        "userId": "3f36f592-8062-4cfb-b3f9-72713256fc18",
        "apiVersion": "2",
        "mitigationFlags": [
          "feature_degraded"
        ],
        "detail": "queue full route=ops-runtime-test-fair-queue partition=tenant:0e67fec0-45d5-421f-bdb4-317ed62182ee routeDepth=3 partitionDepth=3",
        "at": "2026-03-20T17:36:25.662Z"
      },
      {
        "type": "request_queue_rejected",
        "statusCode": 429,
        "method": "POST",
        "route": "/api/ops-runtime-test/fair-queue/hold",
        "requestId": "689a7a22-9b1d-47b9-806f-9ae09dc060dc",
        "traceId": "7edda911a22b49a2af4e8272c47e1b28",
        "tenantId": "0e67fec0-45d5-421f-bdb4-317ed62182ee",
        "userId": "3f36f592-8062-4cfb-b3f9-72713256fc18",
        "apiVersion": "2",
        "mitigationFlags": [
          "feature_degraded"
        ],
        "detail": "queue full route=ops-runtime-test-fair-queue partition=tenant:0e67fec0-45d5-421f-bdb4-317ed62182ee routeDepth=3 partitionDepth=3",
        "at": "2026-03-20T17:36:25.618Z"
      },
      {
        "type": "request_queued",
        "statusCode": null,
        "method": "POST",
        "route": "/api/ops-runtime-test/fair-queue/hold",
        "requestId": "6740db9d-11c8-4643-bab4-3982ee73307f",
        "traceId": "e6b81fb1ef5a440cb8875c8c7b09e225",
        "tenantId": "0e67fec0-45d5-421f-bdb4-317ed62182ee",
        "userId": "3f36f592-8062-4cfb-b3f9-72713256fc18",
        "apiVersion": "2",
        "mitigationFlags": [
          "feature_degraded"
        ],
        "detail": "queued route=ops-runtime-test-fair-queue partition=tenant:0e67fec0-45d5-421f-bdb4-317ed62182ee routeDepth=2 partitionDepth=2",
        "at": "2026-03-20T17:36:25.604Z"
      },
      {
        "type": "request_queue_rejected",
        "statusCode": 429,
        "method": "POST",
        "route": "/api/ops-runtime-test/fair-queue/hold",
        "requestId": "74225d0e-de9c-4728-9007-73013fc326e5",
        "traceId": "b43bffab86434585aae6ca423eb9b078",
        "tenantId": "0e67fec0-45d5-421f-bdb4-317ed62182ee",
        "userId": "3f36f592-8062-4cfb-b3f9-72713256fc18",
        "apiVersion": "2",
        "mitigationFlags": [
          "feature_degraded"
        ],
        "detail": "queue full route=ops-runtime-test-fair-queue partition=tenant:0e67fec0-45d5-421f-bdb4-317ed62182ee routeDepth=3 partitionDepth=3",
        "at": "2026-03-20T17:36:24.051Z"
      },
      {
        "type": "request_queue_rejected",
        "statusCode": 429,
        "method": "POST",
        "route": "/api/ops-runtime-test/fair-queue/hold",
        "requestId": "f0d3fda6-977d-4211-b28d-a6e340887b67",
        "traceId": "29b1c7e9fccc4ecda15b0ef9cac9674b",
        "tenantId": "0e67fec0-45d5-421f-bdb4-317ed62182ee",
        "userId": "3f36f592-8062-4cfb-b3f9-72713256fc18",
        "apiVersion": "2",
        "mitigationFlags": [
          "feature_degraded"
        ],
        "detail": "queue full route=ops-runtime-test-fair-queue partition=tenant:0e67fec0-45d5-421f-bdb4-317ed62182ee routeDepth=3 partitionDepth=3",
        "at": "2026-03-20T17:36:24.041Z"
      },
      {
        "type": "request_queue_rejected",
        "statusCode": 429,
        "method": "POST",
        "route": "/api/ops-runtime-test/fair-queue/hold",
        "requestId": "730512d0-27b4-4744-b3c3-40eecad7abf4",
        "traceId": "98525eb704af4b29964bbc163b91a1ff",
        "tenantId": "0e67fec0-45d5-421f-bdb4-317ed62182ee",
        "userId": "3f36f592-8062-4cfb-b3f9-72713256fc18",
        "apiVersion": "2",
        "mitigationFlags": [
          "feature_degraded"
        ],
        "detail": "queue full route=ops-runtime-test-fair-queue partition=tenant:0e67fec0-45d5-421f-bdb4-317ed62182ee routeDepth=3 partitionDepth=3",
        "at": "2026-03-20T17:36:24.027Z"
      },
      {
        "type": "request_queue_rejected",
        "statusCode": 429,
        "method": "POST",
        "route": "/api/ops-runtime-test/fair-queue/hold",
        "requestId": "da977703-62ce-4da3-9a61-d792c12ac884",
        "traceId": "9288530c66aa407ba5a31b1f15d6b21f",
        "tenantId": "0e67fec0-45d5-421f-bdb4-317ed62182ee",
        "userId": "3f36f592-8062-4cfb-b3f9-72713256fc18",
        "apiVersion": "2",
        "mitigationFlags": [
          "feature_degraded"
        ],
        "detail": "queue full route=ops-runtime-test-fair-queue partition=tenant:0e67fec0-45d5-421f-bdb4-317ed62182ee routeDepth=3 partitionDepth=3",
        "at": "2026-03-20T17:36:24.014Z"
      },
      {
        "type": "circuit_half_open",
        "statusCode": null,
        "method": "GET",
        "route": "/ops-runtime-test/dependency/check",
        "requestId": "1ee0e33b-e9db-4c2a-9741-05047b921c1c",
        "traceId": "f95ebdab048c471d843796ece35831a7",
        "tenantId": "cfea578a-1b9b-4999-9722-f213833e9846",
        "userId": "1cb56205-ab6f-44f3-bad0-48b6e909c915",
        "apiVersion": "2",
        "mitigationFlags": [
          "feature_degraded"
        ],
        "detail": "circuit half-open key=dependency:ops-runtime-test probes=2",
        "at": "2026-03-20T17:36:23.757Z"
      },
      {
        "type": "circuit_open",
        "statusCode": null,
        "method": "GET",
        "route": "/ops-runtime-test/dependency/check",
        "requestId": "edb32510-0fe1-4109-b0de-ca1769126c65",
        "traceId": "c61a5323fa71457d9b0717158d595072",
        "tenantId": "cfea578a-1b9b-4999-9722-f213833e9846",
        "userId": "1cb56205-ab6f-44f3-bad0-48b6e909c915",
        "apiVersion": "2",
        "mitigationFlags": [
          "feature_degraded"
        ],
        "detail": "circuit open key=dependency:ops-runtime-test retryAfterMs=4229",
        "at": "2026-03-20T17:36:19.199Z"
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
        "detail": "adaptive load shedding factor=0.99 desired=1 overloadedInstances=0/2",
        "at": "2026-03-20T17:36:15.739Z"
      },
      {
        "type": "request_queued",
        "statusCode": null,
        "method": "POST",
        "route": "/api/ops-runtime-test/fair-queue/hold",
        "requestId": "9ab86af0-ef8a-4988-8f99-2304952135e5",
        "traceId": "1906ff3482b744f19942a6ef4a268632",
        "tenantId": "0e67fec0-45d5-421f-bdb4-317ed62182ee",
        "userId": "3f36f592-8062-4cfb-b3f9-72713256fc18",
        "apiVersion": "2",
        "mitigationFlags": [
          "feature_degraded"
        ],
        "detail": "queued route=ops-runtime-test-fair-queue partition=tenant:0e67fec0-45d5-421f-bdb4-317ed62182ee routeDepth=1 partitionDepth=1",
        "at": "2026-03-20T17:36:14.506Z"
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
        "detail": "adaptive load shedding factor=0.99 desired=1 overloadedInstances=0/1",
        "at": "2026-03-20T17:36:13.466Z"
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
        "detail": "adaptive load shedding factor=0.99 desired=1 overloadedInstances=0/1",
        "at": "2026-03-20T17:36:08.697Z"
      }
    ]
  },
  "loadShedding": {
    "instanceId": "backend-a",
    "instanceCount": 2,
    "overloadedInstances": 0,
    "adaptiveThrottleFactor": 1,
    "desiredAdaptiveThrottleFactor": 1,
    "pressureCause": "normal",
    "stateConsistency": "distributed",
    "local": {
      "eventLoopLagP95Ms": 31.59,
      "eventLoopLagP99Ms": 33.44,
      "eventLoopLagMaxMs": 33.44,
      "eventLoopUtilization": 0.0123,
      "heapUsedRatio": 0.927,
      "recentApiLatencyMs": 253.04,
      "gcPauseP95Ms": 4.67,
      "gcPauseMaxMs": 13.87,
      "gcEventsRecent": 42,
      "queueDepth": 0,
      "activeIsolatedRequests": 0,
      "pressureScore": 0,
      "consecutiveBreaches": 0,
      "adaptiveThrottleFactor": 1,
      "cause": "normal",
      "overloaded": false
    },
    "clusterRecentApiLatencyMs": 360.25,
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
- Duracao: 21326 ms
- Esperado: Cluster deve degradar de forma controlada, expor mitigacao/alertas e evitar comportamento caotico sob falha combinada.
- Observado:
```json
{
  "queue": {
    "count": 8,
    "avgDurationMs": 4797.88,
    "avgQueueWaitMs": 4615.5,
    "maxQueueWaitMs": 4809,
    "rejected": 2
  },
  "rateLimited": 12,
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
    "adaptiveThrottleFactor": 1,
    "desiredAdaptiveThrottleFactor": 1,
    "pressureCause": "normal",
    "stateConsistency": "local_fallback",
    "local": {
      "eventLoopLagP95Ms": 32.57,
      "eventLoopLagP99Ms": 34.37,
      "eventLoopLagMaxMs": 34.37,
      "eventLoopUtilization": 0.0048,
      "heapUsedRatio": 0.9112,
      "recentApiLatencyMs": 243.94,
      "gcPauseP95Ms": 4.67,
      "gcPauseMaxMs": 13.87,
      "gcEventsRecent": 50,
      "queueDepth": 0,
      "activeIsolatedRequests": 0,
      "pressureScore": 0,
      "consecutiveBreaches": 0,
      "adaptiveThrottleFactor": 1,
      "cause": "normal",
      "overloaded": false
    },
    "clusterRecentApiLatencyMs": 243.94,
    "clusterQueueDepth": 0,
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
    "adaptiveThrottleFactor": 1,
    "pressureCause": "normal",
    "instanceCount": 1,
    "overloadedInstances": 0,
    "stateConsistency": "local_fallback",
    "clusterRecentApiLatencyMs": 240.14,
    "clusterQueueDepth": 0,
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

