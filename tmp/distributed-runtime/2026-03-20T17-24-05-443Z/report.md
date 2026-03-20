# Distributed Runtime Proof

Gerado em: 2026-03-20T17:25:40.283Z

## Ambiente

- Instancias backend: backend-a (http://127.0.0.1:4101), backend-b (http://127.0.0.1:4102)
- Redis: Docker + Toxiproxy
- Postgres: Docker
- Dependency stub: host local em 127.0.0.1:4600
- Tenant A: 91692144-93a5-4551-95a7-4e7e92c9e2fe
- Tenant B: 85f81757-b348-4203-a667-f4af808a38db

## fairness-global

- Titulo: Fairness global por tenant
- Duracao: 1369 ms
- Esperado: Tenant B deve receber grants antes de Tenant A consumir toda a fila.
- Observado:
```json
{
  "tenantA": {
    "count": 6,
    "avgDurationMs": 611.33,
    "avgQueueWaitMs": 684.75,
    "maxQueueWaitMs": 1243,
    "rejected": 2
  },
  "tenantB": {
    "count": 3,
    "avgDurationMs": 818.67,
    "avgQueueWaitMs": 694,
    "maxQueueWaitMs": 1069,
    "rejected": 0
  },
  "orderedStarts": [
    {
      "label": "tenant-a-1",
      "startedAt": "2026-03-20T17:24:51.420Z",
      "tenantId": "91692144-93a5-4551-95a7-4e7e92c9e2fe",
      "instanceId": "backend-a"
    },
    {
      "label": "tenant-b-1",
      "startedAt": "2026-03-20T17:24:51.655Z",
      "tenantId": "85f81757-b348-4203-a667-f4af808a38db",
      "instanceId": "backend-b"
    },
    {
      "label": "tenant-a-3",
      "startedAt": "2026-03-20T17:24:51.873Z",
      "tenantId": "91692144-93a5-4551-95a7-4e7e92c9e2fe",
      "instanceId": "backend-a"
    },
    {
      "label": "tenant-b-2",
      "startedAt": "2026-03-20T17:24:52.101Z",
      "tenantId": "85f81757-b348-4203-a667-f4af808a38db",
      "instanceId": "backend-a"
    },
    {
      "label": "tenant-a-5",
      "startedAt": "2026-03-20T17:24:52.310Z",
      "tenantId": "91692144-93a5-4551-95a7-4e7e92c9e2fe",
      "instanceId": "backend-a"
    },
    {
      "label": "tenant-b-3",
      "startedAt": "2026-03-20T17:24:52.441Z",
      "tenantId": "85f81757-b348-4203-a667-f4af808a38db",
      "instanceId": "backend-b"
    },
    {
      "label": "tenant-a-2",
      "startedAt": "2026-03-20T17:24:52.612Z",
      "tenantId": "91692144-93a5-4551-95a7-4e7e92c9e2fe",
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
          "partitionKey": "tenant:91692144-93a5-4551-95a7-4e7e92c9e2fe",
          "tenantId": "91692144-93a5-4551-95a7-4e7e92c9e2fe",
          "userId": "d29930d3-e532-4b01-8675-fc6867b76efa",
          "clientIp": "127.0.0.1",
          "active": 0,
          "queued": 3,
          "grantedCount": 1,
          "lastGrantedAt": "2026-03-20T17:24:51.412Z"
        },
        {
          "partitionKey": "tenant:85f81757-b348-4203-a667-f4af808a38db",
          "tenantId": "85f81757-b348-4203-a667-f4af808a38db",
          "userId": "0274bda3-6a2f-414a-96da-5eb766a8881a",
          "clientIp": "127.0.0.1",
          "active": 1,
          "queued": 2,
          "grantedCount": 1,
          "lastGrantedAt": "2026-03-20T17:24:51.650Z"
        }
      ]
    },
    "backendB": {
      "routePolicyId": "ops-runtime-test-fair-queue",
      "active": 1,
      "queued": 5,
      "maxConcurrentRequests": 1,
      "maxConcurrentPerPartition": 1,
      "maxQueueDepth": 6,
      "maxQueueDepthPerPartition": 3,
      "partitions": [
        {
          "partitionKey": "tenant:91692144-93a5-4551-95a7-4e7e92c9e2fe",
          "tenantId": "91692144-93a5-4551-95a7-4e7e92c9e2fe",
          "userId": "d29930d3-e532-4b01-8675-fc6867b76efa",
          "clientIp": "127.0.0.1",
          "active": 0,
          "queued": 3,
          "grantedCount": 1,
          "lastGrantedAt": "2026-03-20T17:24:51.412Z"
        },
        {
          "partitionKey": "tenant:85f81757-b348-4203-a667-f4af808a38db",
          "tenantId": "85f81757-b348-4203-a667-f4af808a38db",
          "userId": "0274bda3-6a2f-414a-96da-5eb766a8881a",
          "clientIp": "127.0.0.1",
          "active": 1,
          "queued": 2,
          "grantedCount": 1,
          "lastGrantedAt": "2026-03-20T17:24:51.650Z"
        }
      ]
    }
  }
}
```

## redis-unavailable

- Titulo: Redis indisponivel em trafego real
- Duracao: 9573 ms
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
      "sentAt": "2026-03-20T17:24:56.965Z",
      "completedAt": "2026-03-20T17:24:57.094Z",
      "durationMs": 129,
      "queueWaitMs": 26,
      "status": 201,
      "ok": true,
      "headers": {
        "access-control-allow-credentials": "true",
        "access-control-expose-headers": "Content-Type,Content-Length,Content-Encoding,X-Request-Id,X-Trace-Id,Traceparent,Baggage,X-Total-Count,X-API-Version,X-API-Latest-Version,X-API-Supported-Versions,X-API-Deprecated,Deprecation,Sunset,Link,Warning",
        "baggage": "v=2,tid=91692144-93a5-4551-95a7-4e7e92c9e2fe,uid=d29930d3-e532-4b01-8675-fc6867b76efa",
        "connection": "keep-alive",
        "content-length": "447",
        "content-security-policy": "default-src 'self';style-src 'self' 'unsafe-inline';script-src 'self';img-src 'self' data: https: blob: http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000;connect-src 'self' http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000 ws://localhost:4000 wss://localhost:4000 ws://localhost:5000 wss://localhost:5000;font-src 'self' data: https://fonts.gstatic.com;object-src 'none';media-src 'self';frame-src 'none';base-uri 'self';form-action 'self';frame-ancestors 'none';script-src-attr 'none';upgrade-insecure-requests",
        "content-type": "application/json; charset=utf-8",
        "cross-origin-embedder-policy": "unsafe-none",
        "cross-origin-opener-policy": "unsafe-none",
        "cross-origin-resource-policy": "cross-origin",
        "date": "Fri, 20 Mar 2026 17:24:57 GMT",
        "etag": "W/\"1bf-UunKA+gfU4n6rw2Ule9suIVEVG0\"",
        "keep-alive": "timeout=5",
        "origin-agent-cluster": "?1",
        "referrer-policy": "strict-origin-when-cross-origin",
        "traceparent": "00-3dc8d29a083a45bfbaf7ca036e8ecef8-a68d906c48284f7d-01",
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
        "x-request-id": "68dcf8d1-3bdd-4f90-9b37-20adca5cbf07",
        "x-trace-id": "3dc8d29a083a45bfbaf7ca036e8ecef8",
        "x-xss-protection": "0"
      },
      "body": {
        "ok": true,
        "operation": "fair-queue-hold",
        "instanceId": "backend-a",
        "tenantId": "91692144-93a5-4551-95a7-4e7e92c9e2fe",
        "userId": "d29930d3-e532-4b01-8675-fc6867b76efa",
        "configuredDelayMs": 100,
        "startedAt": "2026-03-20T17:24:56.991Z",
        "completedAt": "2026-03-20T17:24:57.092Z",
        "durationMs": 101,
        "trace": {
          "requestId": "68dcf8d1-3bdd-4f90-9b37-20adca5cbf07",
          "traceId": "3dc8d29a083a45bfbaf7ca036e8ecef8",
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
      "sentAt": "2026-03-20T17:24:56.966Z",
      "completedAt": "2026-03-20T17:24:57.108Z",
      "durationMs": 142,
      "queueWaitMs": 27,
      "status": 201,
      "ok": true,
      "headers": {
        "access-control-allow-credentials": "true",
        "access-control-expose-headers": "Content-Type,Content-Length,Content-Encoding,X-Request-Id,X-Trace-Id,Traceparent,Baggage,X-Total-Count,X-API-Version,X-API-Latest-Version,X-API-Supported-Versions,X-API-Deprecated,Deprecation,Sunset,Link,Warning",
        "baggage": "v=2,tid=91692144-93a5-4551-95a7-4e7e92c9e2fe,uid=d29930d3-e532-4b01-8675-fc6867b76efa",
        "connection": "keep-alive",
        "content-length": "447",
        "content-security-policy": "default-src 'self';style-src 'self' 'unsafe-inline';script-src 'self';img-src 'self' data: https: blob: http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000;connect-src 'self' http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000 ws://localhost:4000 wss://localhost:4000 ws://localhost:5000 wss://localhost:5000;font-src 'self' data: https://fonts.gstatic.com;object-src 'none';media-src 'self';frame-src 'none';base-uri 'self';form-action 'self';frame-ancestors 'none';script-src-attr 'none';upgrade-insecure-requests",
        "content-type": "application/json; charset=utf-8",
        "cross-origin-embedder-policy": "unsafe-none",
        "cross-origin-opener-policy": "unsafe-none",
        "cross-origin-resource-policy": "cross-origin",
        "date": "Fri, 20 Mar 2026 17:24:57 GMT",
        "etag": "W/\"1bf-sfGLD+bqsWWiRWK9OEdjs91IoaQ\"",
        "keep-alive": "timeout=5",
        "origin-agent-cluster": "?1",
        "referrer-policy": "strict-origin-when-cross-origin",
        "traceparent": "00-35fd74149edb408fbf95eb67c779573f-f69f18bac79f4d66-01",
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
        "x-request-id": "53b98937-3d00-4433-8500-d12671c49a72",
        "x-trace-id": "35fd74149edb408fbf95eb67c779573f",
        "x-xss-protection": "0"
      },
      "body": {
        "ok": true,
        "operation": "fair-queue-hold",
        "instanceId": "backend-b",
        "tenantId": "91692144-93a5-4551-95a7-4e7e92c9e2fe",
        "userId": "d29930d3-e532-4b01-8675-fc6867b76efa",
        "configuredDelayMs": 100,
        "startedAt": "2026-03-20T17:24:56.993Z",
        "completedAt": "2026-03-20T17:24:57.104Z",
        "durationMs": 111,
        "trace": {
          "requestId": "53b98937-3d00-4433-8500-d12671c49a72",
          "traceId": "35fd74149edb408fbf95eb67c779573f",
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
- Duracao: 6414 ms
- Esperado: Health snapshot e payload operacional devem refletir latencia/falha Redis com degradacao explicita.
- Observado:
```json
{
  "traffic": [
    {
      "label": "intermittent-1",
      "baseUrl": "http://127.0.0.1:4101",
      "routePath": "/api/ops-runtime-test/fair-queue/hold?holdMs=700",
      "sentAt": "2026-03-20T17:25:04.336Z",
      "completedAt": "2026-03-20T17:25:04.490Z",
      "durationMs": 154,
      "queueWaitMs": 39,
      "status": 201,
      "ok": true,
      "headers": {
        "access-control-allow-credentials": "true",
        "access-control-expose-headers": "Content-Type,Content-Length,Content-Encoding,X-Request-Id,X-Trace-Id,Traceparent,Baggage,X-Total-Count,X-API-Version,X-API-Latest-Version,X-API-Supported-Versions,X-API-Deprecated,Deprecation,Sunset,Link,Warning",
        "baggage": "v=2,tid=91692144-93a5-4551-95a7-4e7e92c9e2fe,uid=d29930d3-e532-4b01-8675-fc6867b76efa",
        "connection": "keep-alive",
        "content-length": "447",
        "content-security-policy": "default-src 'self';style-src 'self' 'unsafe-inline';script-src 'self';img-src 'self' data: https: blob: http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000;connect-src 'self' http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000 ws://localhost:4000 wss://localhost:4000 ws://localhost:5000 wss://localhost:5000;font-src 'self' data: https://fonts.gstatic.com;object-src 'none';media-src 'self';frame-src 'none';base-uri 'self';form-action 'self';frame-ancestors 'none';script-src-attr 'none';upgrade-insecure-requests",
        "content-type": "application/json; charset=utf-8",
        "cross-origin-embedder-policy": "unsafe-none",
        "cross-origin-opener-policy": "unsafe-none",
        "cross-origin-resource-policy": "cross-origin",
        "date": "Fri, 20 Mar 2026 17:25:04 GMT",
        "etag": "W/\"1bf-/2M2VaYJO1+Dm7lpCgYUFuk7Wp8\"",
        "keep-alive": "timeout=5",
        "origin-agent-cluster": "?1",
        "referrer-policy": "strict-origin-when-cross-origin",
        "traceparent": "00-5faa898e7f8c4538ba9811a226eb0c4b-ddf3fe36957446f5-01",
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
        "x-request-id": "0953a704-d129-4338-9038-fbb849708ea6",
        "x-trace-id": "5faa898e7f8c4538ba9811a226eb0c4b",
        "x-xss-protection": "0"
      },
      "body": {
        "ok": true,
        "operation": "fair-queue-hold",
        "instanceId": "backend-a",
        "tenantId": "91692144-93a5-4551-95a7-4e7e92c9e2fe",
        "userId": "d29930d3-e532-4b01-8675-fc6867b76efa",
        "configuredDelayMs": 100,
        "startedAt": "2026-03-20T17:25:04.375Z",
        "completedAt": "2026-03-20T17:25:04.486Z",
        "durationMs": 111,
        "trace": {
          "requestId": "0953a704-d129-4338-9038-fbb849708ea6",
          "traceId": "5faa898e7f8c4538ba9811a226eb0c4b",
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
      "sentAt": "2026-03-20T17:25:04.336Z",
      "completedAt": "2026-03-20T17:25:04.488Z",
      "durationMs": 152,
      "queueWaitMs": 37,
      "status": 201,
      "ok": true,
      "headers": {
        "access-control-allow-credentials": "true",
        "access-control-expose-headers": "Content-Type,Content-Length,Content-Encoding,X-Request-Id,X-Trace-Id,Traceparent,Baggage,X-Total-Count,X-API-Version,X-API-Latest-Version,X-API-Supported-Versions,X-API-Deprecated,Deprecation,Sunset,Link,Warning",
        "baggage": "v=2,tid=91692144-93a5-4551-95a7-4e7e92c9e2fe,uid=d29930d3-e532-4b01-8675-fc6867b76efa",
        "connection": "keep-alive",
        "content-length": "447",
        "content-security-policy": "default-src 'self';style-src 'self' 'unsafe-inline';script-src 'self';img-src 'self' data: https: blob: http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000;connect-src 'self' http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000 ws://localhost:4000 wss://localhost:4000 ws://localhost:5000 wss://localhost:5000;font-src 'self' data: https://fonts.gstatic.com;object-src 'none';media-src 'self';frame-src 'none';base-uri 'self';form-action 'self';frame-ancestors 'none';script-src-attr 'none';upgrade-insecure-requests",
        "content-type": "application/json; charset=utf-8",
        "cross-origin-embedder-policy": "unsafe-none",
        "cross-origin-opener-policy": "unsafe-none",
        "cross-origin-resource-policy": "cross-origin",
        "date": "Fri, 20 Mar 2026 17:25:04 GMT",
        "etag": "W/\"1bf-3K3N+QaJhLW0jWwltw3qZfe0Lnk\"",
        "keep-alive": "timeout=5",
        "origin-agent-cluster": "?1",
        "referrer-policy": "strict-origin-when-cross-origin",
        "traceparent": "00-1c2385d6ef744fd0a1e4b1987f361a71-ee0acc2256a84133-01",
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
        "x-request-id": "2c79941b-64fe-444d-aff5-54d39a54f7d8",
        "x-trace-id": "1c2385d6ef744fd0a1e4b1987f361a71",
        "x-xss-protection": "0"
      },
      "body": {
        "ok": true,
        "operation": "fair-queue-hold",
        "instanceId": "backend-b",
        "tenantId": "91692144-93a5-4551-95a7-4e7e92c9e2fe",
        "userId": "d29930d3-e532-4b01-8675-fc6867b76efa",
        "configuredDelayMs": 100,
        "startedAt": "2026-03-20T17:25:04.373Z",
        "completedAt": "2026-03-20T17:25:04.486Z",
        "durationMs": 113,
        "trace": {
          "requestId": "2c79941b-64fe-444d-aff5-54d39a54f7d8",
          "traceId": "1c2385d6ef744fd0a1e4b1987f361a71",
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
      "sentAt": "2026-03-20T17:25:04.337Z",
      "completedAt": "2026-03-20T17:25:04.608Z",
      "durationMs": 271,
      "queueWaitMs": 167,
      "status": 201,
      "ok": true,
      "headers": {
        "access-control-allow-credentials": "true",
        "access-control-expose-headers": "Content-Type,Content-Length,Content-Encoding,X-Request-Id,X-Trace-Id,Traceparent,Baggage,X-Total-Count,X-API-Version,X-API-Latest-Version,X-API-Supported-Versions,X-API-Deprecated,Deprecation,Sunset,Link,Warning",
        "baggage": "v=2,tid=91692144-93a5-4551-95a7-4e7e92c9e2fe,uid=d29930d3-e532-4b01-8675-fc6867b76efa",
        "connection": "keep-alive",
        "content-length": "447",
        "content-security-policy": "default-src 'self';style-src 'self' 'unsafe-inline';script-src 'self';img-src 'self' data: https: blob: http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000;connect-src 'self' http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000 ws://localhost:4000 wss://localhost:4000 ws://localhost:5000 wss://localhost:5000;font-src 'self' data: https://fonts.gstatic.com;object-src 'none';media-src 'self';frame-src 'none';base-uri 'self';form-action 'self';frame-ancestors 'none';script-src-attr 'none';upgrade-insecure-requests",
        "content-type": "application/json; charset=utf-8",
        "cross-origin-embedder-policy": "unsafe-none",
        "cross-origin-opener-policy": "unsafe-none",
        "cross-origin-resource-policy": "cross-origin",
        "date": "Fri, 20 Mar 2026 17:25:04 GMT",
        "etag": "W/\"1bf-TAlT/tzcxjFWjm+tqSolePIrLQk\"",
        "keep-alive": "timeout=5",
        "origin-agent-cluster": "?1",
        "referrer-policy": "strict-origin-when-cross-origin",
        "traceparent": "00-0578715ba7b947548e9a9385542504dc-e3fb9661a8c74680-01",
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
        "x-request-id": "41b65cfa-cd8c-4cb7-a72e-f7726b5ad0e8",
        "x-trace-id": "0578715ba7b947548e9a9385542504dc",
        "x-xss-protection": "0"
      },
      "body": {
        "ok": true,
        "operation": "fair-queue-hold",
        "instanceId": "backend-a",
        "tenantId": "91692144-93a5-4551-95a7-4e7e92c9e2fe",
        "userId": "d29930d3-e532-4b01-8675-fc6867b76efa",
        "configuredDelayMs": 100,
        "startedAt": "2026-03-20T17:25:04.504Z",
        "completedAt": "2026-03-20T17:25:04.605Z",
        "durationMs": 101,
        "trace": {
          "requestId": "41b65cfa-cd8c-4cb7-a72e-f7726b5ad0e8",
          "traceId": "0578715ba7b947548e9a9385542504dc",
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
      "sentAt": "2026-03-20T17:25:04.337Z",
      "completedAt": "2026-03-20T17:25:04.609Z",
      "durationMs": 272,
      "queueWaitMs": 166,
      "status": 201,
      "ok": true,
      "headers": {
        "access-control-allow-credentials": "true",
        "access-control-expose-headers": "Content-Type,Content-Length,Content-Encoding,X-Request-Id,X-Trace-Id,Traceparent,Baggage,X-Total-Count,X-API-Version,X-API-Latest-Version,X-API-Supported-Versions,X-API-Deprecated,Deprecation,Sunset,Link,Warning",
        "baggage": "v=2,tid=91692144-93a5-4551-95a7-4e7e92c9e2fe,uid=d29930d3-e532-4b01-8675-fc6867b76efa",
        "connection": "keep-alive",
        "content-length": "447",
        "content-security-policy": "default-src 'self';style-src 'self' 'unsafe-inline';script-src 'self';img-src 'self' data: https: blob: http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000;connect-src 'self' http://localhost:4000 https://localhost:4000 http://localhost:5000 https://localhost:5000 http://localhost:3000 https://localhost:3000 ws://localhost:4000 wss://localhost:4000 ws://localhost:5000 wss://localhost:5000;font-src 'self' data: https://fonts.gstatic.com;object-src 'none';media-src 'self';frame-src 'none';base-uri 'self';form-action 'self';frame-ancestors 'none';script-src-attr 'none';upgrade-insecure-requests",
        "content-type": "application/json; charset=utf-8",
        "cross-origin-embedder-policy": "unsafe-none",
        "cross-origin-opener-policy": "unsafe-none",
        "cross-origin-resource-policy": "cross-origin",
        "date": "Fri, 20 Mar 2026 17:25:04 GMT",
        "etag": "W/\"1bf-sG+SMimuKilgL6AU9JlwNd2W9Sk\"",
        "keep-alive": "timeout=5",
        "origin-agent-cluster": "?1",
        "referrer-policy": "strict-origin-when-cross-origin",
        "traceparent": "00-060dd90d0ee14fbb9b0ae9908ce63003-e6fd637ee7cd4893-01",
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
        "x-request-id": "84c3967f-e2ad-403a-8068-ee2e3ba823a8",
        "x-trace-id": "060dd90d0ee14fbb9b0ae9908ce63003",
        "x-xss-protection": "0"
      },
      "body": {
        "ok": true,
        "operation": "fair-queue-hold",
        "instanceId": "backend-b",
        "tenantId": "91692144-93a5-4551-95a7-4e7e92c9e2fe",
        "userId": "d29930d3-e532-4b01-8675-fc6867b76efa",
        "configuredDelayMs": 100,
        "startedAt": "2026-03-20T17:25:04.503Z",
        "completedAt": "2026-03-20T17:25:04.605Z",
        "durationMs": 102,
        "trace": {
          "requestId": "84c3967f-e2ad-403a-8068-ee2e3ba823a8",
          "traceId": "060dd90d0ee14fbb9b0ae9908ce63003",
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
- Duracao: 4980 ms
- Esperado: Uma falha isolada nao deve abrir circuito; duas instancias votando devem abrir, half-open deve permitir probes limitados e recuperar gradualmente.
- Observado:
```json
{
  "firstFailure": {
    "ok": false,
    "statusCode": 502,
    "mode": "failure",
    "instanceId": "backend-a",
    "durationMs": 75,
    "tenantId": "ef1fa0f9-7362-4cc9-a89d-61e19e9c4e51",
    "trace": {
      "requestId": "bd33748a-8046-4c14-9783-996a95a8cdb4",
      "traceId": "40148a0e0603495187209e7152f2af58",
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
      "lastTransitionAt": 1774027508787,
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
    "durationMs": 78,
    "tenantId": "ef1fa0f9-7362-4cc9-a89d-61e19e9c4e51",
    "trace": {
      "requestId": "c637800e-8563-4fbd-8eae-482e294ba5a5",
      "traceId": "001b52d567ea4a6c9c4ce5f540e11c58",
      "apiVersion": "2",
      "mitigationFlags": [],
      "baggageBytes": 85
    },
    "breaker": {
      "key": "dependency:ops-runtime-test",
      "mode": "open",
      "failures": 2,
      "openCount": 1,
      "openedUntil": 1774027512958,
      "halfOpenInFlight": 0,
      "halfOpenProbeAttempts": 0,
      "halfOpenSuccesses": 0,
      "consecutiveSuccesses": 0,
      "lastTransitionAt": 1774027508974,
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
    "tenantId": "ef1fa0f9-7362-4cc9-a89d-61e19e9c4e51",
    "trace": {
      "requestId": "2331ef04-54f4-47d6-b6e8-d920fa27eda1",
      "traceId": "99d09b63c3164df3bf954f8dfafd582a",
      "apiVersion": "2",
      "mitigationFlags": [],
      "baggageBytes": 85
    },
    "breaker": {
      "key": "dependency:ops-runtime-test",
      "mode": "open",
      "failures": 2,
      "openCount": 1,
      "openedUntil": 1774027512958,
      "halfOpenInFlight": 0,
      "halfOpenProbeAttempts": 0,
      "halfOpenSuccesses": 0,
      "consecutiveSuccesses": 0,
      "lastTransitionAt": 1774027508974,
      "failureVoters": 2,
      "recoveryVoters": 0
    },
    "error": {
      "message": "Circuit breaker aberto para dependency:ops-runtime-test",
      "retryAfterMs": 3946
    }
  },
  "recoveryProbeA": {
    "ok": true,
    "statusCode": 200,
    "mode": "ok",
    "instanceId": "backend-a",
    "durationMs": 29,
    "tenantId": "ef1fa0f9-7362-4cc9-a89d-61e19e9c4e51",
    "trace": {
      "requestId": "b4e638a6-eb79-4f9e-8cb2-d4b01896d7ed",
      "traceId": "3e3bef3e0c21424d908ed7d911385c8b",
      "apiVersion": "2",
      "mitigationFlags": [],
      "baggageBytes": 85
    },
    "breaker": {
      "key": "dependency:ops-runtime-test",
      "mode": "half-open",
      "failures": 2,
      "openCount": 1,
      "openedUntil": 1774027512958,
      "halfOpenInFlight": 0,
      "halfOpenProbeAttempts": 1,
      "halfOpenSuccesses": 1,
      "consecutiveSuccesses": 1,
      "lastTransitionAt": 1774027513569,
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
        "x-request-id": "b4e638a6-eb79-4f9e-8cb2-d4b01896d7ed",
        "x-trace-id": "3e3bef3e0c21424d908ed7d911385c8b",
        "traceparent": "00-3e3bef3e0c21424d908ed7d911385c8b-79b36b1a91d14225-01",
        "baggage": "v=2,tid=ef1fa0f9-7362-4cc9-a89d-61e19e9c4e51,uid=608575e0-5ffb-41a1-866a-51beac7d3886"
      }
    }
  },
  "recoveryProbeB": {
    "ok": true,
    "statusCode": 200,
    "mode": "ok",
    "instanceId": "backend-b",
    "durationMs": 33,
    "tenantId": "ef1fa0f9-7362-4cc9-a89d-61e19e9c4e51",
    "trace": {
      "requestId": "2627b56a-d2cf-4643-8cfc-ddf5bb2c94c3",
      "traceId": "dec4f561ab764f9e99138a072b750d3f",
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
      "lastTransitionAt": 1774027513647,
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
        "x-request-id": "2627b56a-d2cf-4643-8cfc-ddf5bb2c94c3",
        "x-trace-id": "dec4f561ab764f9e99138a072b750d3f",
        "traceparent": "00-dec4f561ab764f9e99138a072b750d3f-98f17bb8439249ef-01",
        "baggage": "v=2,tid=ef1fa0f9-7362-4cc9-a89d-61e19e9c4e51,uid=608575e0-5ffb-41a1-866a-51beac7d3886"
      }
    }
  },
  "recovered": {
    "ok": true,
    "statusCode": 200,
    "mode": "ok",
    "instanceId": "backend-a",
    "durationMs": 20,
    "tenantId": "ef1fa0f9-7362-4cc9-a89d-61e19e9c4e51",
    "trace": {
      "requestId": "f8dab99d-55a2-471c-8ecf-8f550b3c96b7",
      "traceId": "c04111e5db514c53a24755a067e66560",
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
      "lastTransitionAt": 1774027513694,
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
        "x-request-id": "f8dab99d-55a2-471c-8ecf-8f550b3c96b7",
        "x-trace-id": "c04111e5db514c53a24755a067e66560",
        "traceparent": "00-c04111e5db514c53a24755a067e66560-7fb26c7e6c2e46dc-01",
        "baggage": "v=2,tid=ef1fa0f9-7362-4cc9-a89d-61e19e9c4e51,uid=608575e0-5ffb-41a1-866a-51beac7d3886"
      }
    }
  }
}
```

## granular-shedding

- Titulo: Shedding granular por tenant e rota
- Duracao: 1790 ms
- Esperado: Tenant pesado deve receber factor reduzido e causa tenant-route, enquanto tenant leve permanece sem penalizacao injusta.
- Observado:
```json
{
  "hammer": {
    "total": 22,
    "blocked": 0,
    "adaptiveFactors": []
  },
  "tenantAContext": {
    "instanceId": "backend-a",
    "tenantId": "91692144-93a5-4551-95a7-4e7e92c9e2fe",
    "path": "/api/ops-runtime-test/rate-limit/ping",
    "trace": {
      "requestId": "e4b2fcca-264d-4320-9f5e-d5d262f5a789",
      "traceId": "e5eab9920b83482893d677ecd08de44b",
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
        "eventLoopLagP95Ms": 35.16,
        "eventLoopLagP99Ms": 35.36,
        "eventLoopLagMaxMs": 35.36,
        "eventLoopUtilization": 0.0212,
        "heapUsedRatio": 0.9061,
        "recentApiLatencyMs": 132.32,
        "gcPauseP95Ms": 14.14,
        "gcPauseMaxMs": 15.26,
        "gcEventsRecent": 21,
        "queueDepth": 0,
        "activeIsolatedRequests": 0,
        "pressureScore": 0,
        "consecutiveBreaches": 0,
        "adaptiveThrottleFactor": 1,
        "cause": "normal",
        "overloaded": false
      },
      "clusterRecentApiLatencyMs": 139.47,
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
    "tenantId": "85f81757-b348-4203-a667-f4af808a38db",
    "path": "/api/ops-runtime-test/rate-limit/ping",
    "trace": {
      "requestId": "102e3b39-8ee3-484c-aeee-39b03b3dd93f",
      "traceId": "9cf7965f364e4cfab43ec02956cc4033",
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
        "eventLoopLagP95Ms": 35.16,
        "eventLoopLagP99Ms": 35.36,
        "eventLoopLagMaxMs": 35.36,
        "eventLoopUtilization": 0.0212,
        "heapUsedRatio": 0.9061,
        "recentApiLatencyMs": 132.32,
        "gcPauseP95Ms": 14.14,
        "gcPauseMaxMs": 15.26,
        "gcEventsRecent": 21,
        "queueDepth": 0,
        "activeIsolatedRequests": 0,
        "pressureScore": 0,
        "consecutiveBreaches": 0,
        "adaptiveThrottleFactor": 1,
        "cause": "normal",
        "overloaded": false
      },
      "clusterRecentApiLatencyMs": 139.47,
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
- Duracao: 11572 ms
- Esperado: Adaptive factor deve cair com suavizacao, nao oscilar agressivamente e recuperar de forma gradual apos estabilidade.
- Observado:
```json
{
  "underLoadSamples": [
    {
      "at": "2026-03-20T17:25:15.545Z",
      "adaptiveThrottleFactor": 1,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 139.47,
      "clusterQueueDepth": 0,
      "featureFlags": []
    },
    {
      "at": "2026-03-20T17:25:16.606Z",
      "adaptiveThrottleFactor": 1,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 133.8,
      "clusterQueueDepth": 0,
      "featureFlags": []
    },
    {
      "at": "2026-03-20T17:25:17.638Z",
      "adaptiveThrottleFactor": 1,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 132.13,
      "clusterQueueDepth": 0,
      "featureFlags": []
    },
    {
      "at": "2026-03-20T17:25:18.690Z",
      "adaptiveThrottleFactor": 1,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 346.14,
      "clusterQueueDepth": 0,
      "featureFlags": []
    },
    {
      "at": "2026-03-20T17:25:19.741Z",
      "adaptiveThrottleFactor": 1,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 342.6,
      "clusterQueueDepth": 0,
      "featureFlags": []
    },
    {
      "at": "2026-03-20T17:25:20.791Z",
      "adaptiveThrottleFactor": 1,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 339.23,
      "clusterQueueDepth": 0,
      "featureFlags": []
    }
  ],
  "recoverySamples": [
    {
      "at": "2026-03-20T17:25:21.835Z",
      "adaptiveThrottleFactor": 1,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 336.01,
      "clusterQueueDepth": 0,
      "featureFlags": []
    },
    {
      "at": "2026-03-20T17:25:22.882Z",
      "adaptiveThrottleFactor": 1,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 332.94,
      "clusterQueueDepth": 0,
      "featureFlags": []
    },
    {
      "at": "2026-03-20T17:25:23.916Z",
      "adaptiveThrottleFactor": 1,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 330.01,
      "clusterQueueDepth": 0,
      "featureFlags": []
    },
    {
      "at": "2026-03-20T17:25:24.964Z",
      "adaptiveThrottleFactor": 1,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 327.2,
      "clusterQueueDepth": 0,
      "featureFlags": []
    },
    {
      "at": "2026-03-20T17:25:26.005Z",
      "adaptiveThrottleFactor": 1,
      "desiredAdaptiveThrottleFactor": 1,
      "pressureCause": "normal",
      "clusterRecentApiLatencyMs": 324.52,
      "clusterQueueDepth": 0,
      "featureFlags": []
    }
  ],
  "rateLimitHeaders": [
    {
      "status": 200,
      "adaptiveFactor": null,
      "pressureCause": null
    },
    {
      "status": 200,
      "adaptiveFactor": null,
      "pressureCause": null
    },
    {
      "status": 200,
      "adaptiveFactor": null,
      "pressureCause": null
    },
    {
      "status": 200,
      "adaptiveFactor": null,
      "pressureCause": null
    },
    {
      "status": 200,
      "adaptiveFactor": null,
      "pressureCause": null
    },
    {
      "status": 200,
      "adaptiveFactor": null,
      "pressureCause": null
    }
  ]
}
```

## trace-baggage

- Titulo: Trace e baggage sob controle
- Duracao: 3426 ms
- Esperado: Traceparent e baggage devem ser propagados com tenantId, userId, apiVersion e flags sem ultrapassar o limite configurado.
- Observado:
```json
{
  "dependencyResponse": {
    "ok": true,
    "statusCode": 200,
    "mode": "ok",
    "instanceId": "backend-a",
    "durationMs": 33,
    "tenantId": "91692144-93a5-4551-95a7-4e7e92c9e2fe",
    "trace": {
      "requestId": "aedca72e-218f-4309-8d46-3dfe0c925a49",
      "traceId": "4e6dce50f1cb4506b783ae6d5bba26ac",
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
      "lastTransitionAt": 1774027530480,
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
        "x-request-id": "aedca72e-218f-4309-8d46-3dfe0c925a49",
        "x-trace-id": "4e6dce50f1cb4506b783ae6d5bba26ac",
        "traceparent": "00-4e6dce50f1cb4506b783ae6d5bba26ac-a66a1f3255f34ea3-01",
        "baggage": "v=2,tid=91692144-93a5-4551-95a7-4e7e92c9e2fe,uid=d29930d3-e532-4b01-8675-fc6867b76efa"
      }
    }
  },
  "stubObserved": {
    "at": "2026-03-20T17:25:30.472Z",
    "method": "GET",
    "path": "/dependency",
    "traceparent": "00-4e6dce50f1cb4506b783ae6d5bba26ac-a66a1f3255f34ea3-01",
    "baggage": "v=2,tid=91692144-93a5-4551-95a7-4e7e92c9e2fe,uid=d29930d3-e532-4b01-8675-fc6867b76efa",
    "baggageBytes": 85,
    "requestId": "aedca72e-218f-4309-8d46-3dfe0c925a49",
    "traceId": "4e6dce50f1cb4506b783ae6d5bba26ac"
  },
  "baggageUnderControl": true
}
```

## slow-success

- Titulo: Sucesso lento com visibilidade operacional
- Duracao: 3139 ms
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
    "windowStart": "2026-03-20T17:10:33.567Z",
    "windowSeconds": 900,
    "totalEventsRecent": 18,
    "byType": [
      {
        "type": "auto_mitigation",
        "count": 12
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
        "route": "/system/runtime/load-shedding",
        "count": 12
      },
      {
        "route": "/api/ops-runtime-test/fair-queue/hold",
        "count": 4
      },
      {
        "route": "/ops-runtime-test/dependency/check",
        "count": 2
      }
    ],
    "recent": [
      {
        "type": "circuit_half_open",
        "statusCode": null,
        "method": "GET",
        "route": "/ops-runtime-test/dependency/check",
        "requestId": "b4e638a6-eb79-4f9e-8cb2-d4b01896d7ed",
        "traceId": "3e3bef3e0c21424d908ed7d911385c8b",
        "tenantId": "ef1fa0f9-7362-4cc9-a89d-61e19e9c4e51",
        "userId": "608575e0-5ffb-41a1-866a-51beac7d3886",
        "apiVersion": "2",
        "mitigationFlags": [],
        "detail": "circuit half-open key=dependency:ops-runtime-test probes=2",
        "at": "2026-03-20T17:25:13.573Z"
      },
      {
        "type": "circuit_open",
        "statusCode": null,
        "method": "GET",
        "route": "/ops-runtime-test/dependency/check",
        "requestId": "2331ef04-54f4-47d6-b6e8-d920fa27eda1",
        "traceId": "99d09b63c3164df3bf954f8dfafd582a",
        "tenantId": "ef1fa0f9-7362-4cc9-a89d-61e19e9c4e51",
        "userId": "608575e0-5ffb-41a1-866a-51beac7d3886",
        "apiVersion": "2",
        "mitigationFlags": [],
        "detail": "circuit open key=dependency:ops-runtime-test retryAfterMs=3946",
        "at": "2026-03-20T17:25:09.016Z"
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
        "at": "2026-03-20T17:25:05.864Z"
      },
      {
        "type": "request_queued",
        "statusCode": null,
        "method": "POST",
        "route": "/api/ops-runtime-test/fair-queue/hold",
        "requestId": "41b65cfa-cd8c-4cb7-a72e-f7726b5ad0e8",
        "traceId": "0578715ba7b947548e9a9385542504dc",
        "tenantId": "91692144-93a5-4551-95a7-4e7e92c9e2fe",
        "userId": "d29930d3-e532-4b01-8675-fc6867b76efa",
        "apiVersion": "2",
        "mitigationFlags": [],
        "detail": "queued route=ops-runtime-test-fair-queue partition=tenant:91692144-93a5-4551-95a7-4e7e92c9e2fe routeDepth=1 partitionDepth=1",
        "at": "2026-03-20T17:25:04.376Z"
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
        "at": "2026-03-20T17:25:03.580Z"
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
        "at": "2026-03-20T17:25:01.819Z"
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
        "at": "2026-03-20T17:24:57.804Z"
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
        "detail": "adaptive load shedding factor=0.95 desired=1 overloadedInstances=0/1",
        "at": "2026-03-20T17:24:56.793Z"
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
        "detail": "adaptive load shedding factor=0.9 desired=1 overloadedInstances=0/1",
        "at": "2026-03-20T17:24:55.790Z"
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
        "detail": "adaptive load shedding factor=0.85 desired=1 overloadedInstances=0/1",
        "at": "2026-03-20T17:24:54.785Z"
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
        "detail": "adaptive load shedding factor=0.8 desired=1 overloadedInstances=0/1",
        "at": "2026-03-20T17:24:53.773Z"
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
        "detail": "adaptive load shedding factor=0.8 desired=1 overloadedInstances=0/2",
        "at": "2026-03-20T17:24:52.767Z"
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
        "detail": "adaptive load shedding factor=0.8 desired=0.55 overloadedInstances=0/2",
        "at": "2026-03-20T17:24:51.762Z"
      },
      {
        "type": "request_queued",
        "statusCode": null,
        "method": "POST",
        "route": "/api/ops-runtime-test/fair-queue/hold",
        "requestId": "d8d49b19-197f-48ff-93b3-be0c2aa954fe",
        "traceId": "7a35d94eb53d402a9c918f68cbdb7d95",
        "tenantId": "85f81757-b348-4203-a667-f4af808a38db",
        "userId": "0274bda3-6a2f-414a-96da-5eb766a8881a",
        "apiVersion": "2",
        "mitigationFlags": [],
        "detail": "queued route=ops-runtime-test-fair-queue partition=tenant:85f81757-b348-4203-a667-f4af808a38db routeDepth=5 partitionDepth=2",
        "at": "2026-03-20T17:24:51.540Z"
      },
      {
        "type": "request_queued",
        "statusCode": null,
        "method": "POST",
        "route": "/api/ops-runtime-test/fair-queue/hold",
        "requestId": "5589d737-d82f-4754-a069-c1b03ebc85ea",
        "traceId": "74dae5831e0846dbaca10deded95e093",
        "tenantId": "91692144-93a5-4551-95a7-4e7e92c9e2fe",
        "userId": "d29930d3-e532-4b01-8675-fc6867b76efa",
        "apiVersion": "2",
        "mitigationFlags": [],
        "detail": "queued route=ops-runtime-test-fair-queue partition=tenant:91692144-93a5-4551-95a7-4e7e92c9e2fe routeDepth=2 partitionDepth=2",
        "at": "2026-03-20T17:24:51.470Z"
      },
      {
        "type": "request_queued",
        "statusCode": null,
        "method": "POST",
        "route": "/api/ops-runtime-test/fair-queue/hold",
        "requestId": "8ad2d346-a580-4c3a-b204-cf3e981e749f",
        "traceId": "a160fec633d841fa907028f0f629ee35",
        "tenantId": "91692144-93a5-4551-95a7-4e7e92c9e2fe",
        "userId": "d29930d3-e532-4b01-8675-fc6867b76efa",
        "apiVersion": "2",
        "mitigationFlags": [],
        "detail": "queued route=ops-runtime-test-fair-queue partition=tenant:91692144-93a5-4551-95a7-4e7e92c9e2fe routeDepth=1 partitionDepth=1",
        "at": "2026-03-20T17:24:51.442Z"
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
        "at": "2026-03-20T17:24:45.751Z"
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
        "at": "2026-03-20T17:24:44.744Z"
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
      "eventLoopLagP95Ms": 33.52,
      "eventLoopLagP99Ms": 35.49,
      "eventLoopLagMaxMs": 35.49,
      "eventLoopUtilization": 0.01,
      "heapUsedRatio": 0.8825,
      "recentApiLatencyMs": 376.72,
      "gcPauseP95Ms": 14.14,
      "gcPauseMaxMs": 15.26,
      "gcEventsRecent": 38,
      "queueDepth": 0,
      "activeIsolatedRequests": 0,
      "pressureScore": 0,
      "consecutiveBreaches": 0,
      "adaptiveThrottleFactor": 1,
      "cause": "normal",
      "overloaded": false
    },
    "clusterRecentApiLatencyMs": 456.81,
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
      "OPS_CRITICAL_SLOW_ROUTE:GET /api/ops-runtime-test/runtime/slow"
    ],
    "skipped": [
      "OPS_HIGH_5XX_ERROR_RATE",
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

## simultaneous-failure

- Titulo: Falha simultanea sob carga alta
- Duracao: 6649 ms
- Esperado: Cluster deve degradar de forma controlada, expor mitigacao/alertas e evitar comportamento caotico sob falha combinada.
- Observado:
```json
{
  "queue": {
    "count": 8,
    "avgDurationMs": 1151.63,
    "avgQueueWaitMs": 1043.88,
    "maxQueueWaitMs": 1294,
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
    "adaptiveThrottleFactor": 1,
    "desiredAdaptiveThrottleFactor": 1,
    "pressureCause": "normal",
    "stateConsistency": "local_fallback",
    "local": {
      "eventLoopLagP95Ms": 34.11,
      "eventLoopLagP99Ms": 34.73,
      "eventLoopLagMaxMs": 34.73,
      "eventLoopUtilization": 0.1545,
      "heapUsedRatio": 0.9105,
      "recentApiLatencyMs": 311.05,
      "gcPauseP95Ms": 4.23,
      "gcPauseMaxMs": 15.26,
      "gcEventsRecent": 46,
      "queueDepth": 0,
      "activeIsolatedRequests": 1,
      "pressureScore": 0,
      "consecutiveBreaches": 0,
      "adaptiveThrottleFactor": 1,
      "cause": "normal",
      "overloaded": false
    },
    "clusterRecentApiLatencyMs": 311.05,
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
    "clusterRecentApiLatencyMs": 311.05,
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
      "OPS_CRITICAL_SLOW_ROUTE:GET /api/ops-runtime-test/runtime/slow",
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

