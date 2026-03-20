const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const { setTimeout: delay } = require('timers/promises');

const ROOT_DIR = path.resolve(__dirname, '..', '..', '..');
const BACKEND_DIR = path.join(ROOT_DIR, 'apps', 'backend');
const COMPOSE_FILE = path.join(__dirname, 'docker-compose.yml');
const DEPENDENCY_STUB_FILE = path.join(__dirname, 'dependency-stub.cjs');
const RESULTS_ROOT = path.join(ROOT_DIR, 'tmp', 'distributed-runtime');
const DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:55432/runtimeproof?schema=public';
const BACKUP_ADMIN_DATABASE_URL =
  'postgresql://postgres:postgres@127.0.0.1:55432/postgres?schema=public';
const RUNTIME_TEST_DEPENDENCY_URL = 'http://127.0.0.1:46460/dependency';
const BACKEND_NEST_BIN = path.join(BACKEND_DIR, 'node_modules', '.bin', 'nest.CMD');
const BACKEND_PRISMA_BIN = path.join(BACKEND_DIR, 'node_modules', '.bin', 'prisma.CMD');
const BACKEND_TSX_BIN = path.join(BACKEND_DIR, 'node_modules', '.bin', 'tsx.CMD');
const BACKEND_MAIN_FILE = path.join(BACKEND_DIR, 'dist', 'backend', 'src', 'main.js');
const SUPERADMIN_EMAIL = 'admin@system.com';
const SUPERADMIN_PASSWORD = 'SeedSuper#2026Aa';
const TENANT_A_ADMIN_EMAIL = 'ops-admin-a@example.com';
const TENANT_A_ADMIN_PASSWORD = 'TenantA#2026Aa';
const TENANT_B_ADMIN_EMAIL = 'ops-admin-b@example.com';
const TENANT_B_ADMIN_PASSWORD = 'TenantB#2026Aa';
const API_VERSION = '2';
const BACKENDS = [
  {
    name: 'backend-a',
    baseUrl: 'http://127.0.0.1:4101',
    port: '4101',
    nodeAppInstance: 'backend-a',
  },
  {
    name: 'backend-b',
    baseUrl: 'http://127.0.0.1:4102',
    port: '4102',
    nodeAppInstance: 'backend-b',
  },
];

const runtime = {
  artifactsDir: '',
  commands: [],
  processes: [],
  scenarioResults: [],
};

function nowIso() {
  return new Date().toISOString();
}

function slugTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

async function ensureDir(dirPath) {
  await fsp.mkdir(dirPath, { recursive: true });
}

async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fsp.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function appendCommand(command, args, cwd) {
  runtime.commands.push({
    at: nowIso(),
    cwd,
    command: [command, ...args].join(' '),
  });
}

async function runCommand(command, args, options = {}) {
  const cwd = options.cwd || ROOT_DIR;
  const env = { ...process.env, ...(options.env || {}) };
  appendCommand(command, args, cwd);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell: Boolean(options.shell),
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0 || options.allowFailure) {
        resolve({ code, stdout, stderr });
        return;
      }

      const error = new Error(
        `Command failed (${code}): ${[command, ...args].join(' ')}\n${stderr || stdout}`,
      );
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

async function runCmdScript(scriptPath, args, options = {}) {
  return runCommand(scriptPath, args, {
    ...options,
    shell: true,
  });
}

function spawnLogged(name, command, args, options = {}) {
  const cwd = options.cwd || ROOT_DIR;
  const env = { ...process.env, ...(options.env || {}) };
  const logFile = options.logFile;
  appendCommand(command, args, cwd);

  const child = spawn(command, args, {
    cwd,
    env,
    shell: false,
    windowsHide: true,
  });

  const stream = fs.createWriteStream(logFile, { flags: 'a' });
  child.stdout.pipe(stream);
  child.stderr.pipe(stream);
  runtime.processes.push({ name, child, logFile, stream });

  child.on('exit', () => {
    stream.end();
  });

  return { child, logFile };
}

async function waitForLog(logFile, pattern, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const content = await fsp.readFile(logFile, 'utf8');
      if (pattern.test(content)) {
        return content;
      }
    } catch {}
    await delay(250);
  }
  throw new Error(`Timed out waiting for log pattern ${pattern} in ${logFile}`);
}

async function waitForHttpOk(url, options = {}) {
  const deadline = Date.now() + (options.timeoutMs || 45_000);
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: options.headers,
      });
      if (response.ok) {
        return response;
      }
    } catch {}
    await delay(500);
  }
  throw new Error(`Timed out waiting for HTTP 200 at ${url}`);
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  setFromResponse(response) {
    const setCookies =
      typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie()
        : [];

    for (const rawCookie of setCookies) {
      const [pair] = String(rawCookie || '').split(';');
      const separatorIndex = pair.indexOf('=');
      if (separatorIndex <= 0) {
        continue;
      }
      const name = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1).trim();
      if (!name) {
        continue;
      }
      if (!value) {
        this.cookies.delete(name);
        continue;
      }
      this.cookies.set(name, value);
    }
  }

  toHeader() {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
  }
}

async function httpJson(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has('user-agent')) {
    headers.set('user-agent', 'runtime-proof');
  }
  headers.set('x-api-version', API_VERSION);
  if (options.jar) {
    const cookie = options.jar.toHeader();
    if (cookie) {
      headers.set('cookie', cookie);
    }
  }
  if (options.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body:
      options.body === undefined
        ? undefined
        : typeof options.body === 'string'
          ? options.body
          : JSON.stringify(options.body),
    signal: options.signal,
  });

  if (options.jar) {
    options.jar.setFromResponse(response);
  }

  const text = await response.text();
  let json = null;
  if (text.trim()) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }

  return {
    status: response.status,
    ok: response.ok,
    headers: Object.fromEntries(response.headers.entries()),
    json,
    text,
  };
}

function buildBackendEnv(port, nodeAppInstance) {
  return {
    NODE_ENV: 'development',
    PORT: String(port),
    DATABASE_URL,
    BACKUP_ADMIN_DATABASE_URL,
    JWT_SECRET: 'runtime-proof-jwt-secret-2026-ultra-strong-abcdef123456',
    TRUSTED_DEVICE_TOKEN_SECRET:
      'runtime-proof-trusted-device-secret-2026-ultra-strong-abcdef123456',
    ENCRYPTION_KEY: '12345678901234567890123456789012',
    REDIS_MODE: 'standalone',
    REDIS_HOST: '127.0.0.1',
    REDIS_PORT: '46379',
    REDIS_CONNECT_TIMEOUT: '800',
    REDIS_RETRY_COOLDOWN_MS: '2000',
    REDIS_FALLBACK_MODE: 'memory',
    DISTRIBUTED_STATE_FALLBACK_MODE: 'memory',
    RATE_LIMIT_REDIS_ENABLED: 'true',
    RATE_LIMIT_REDIS_CONNECT_TIMEOUT: '800',
    RATE_LIMIT_STORAGE_FAILURE_MODE: 'memory',
    OPS_RUNTIME_TESTS_ENABLED: 'true',
    OPS_RUNTIME_TEST_DEPENDENCY_URL: RUNTIME_TEST_DEPENDENCY_URL,
    INSTALL_ADMIN_PASSWORD: SUPERADMIN_PASSWORD,
    USER_DEFAULT_PASSWORD: SUPERADMIN_PASSWORD,
    NODE_APP_INSTANCE: nodeAppInstance,
    HOSTNAME: nodeAppInstance,
    FRONTEND_URL: 'http://127.0.0.1:3000',
  };
}

async function dockerCompose(args) {
  return runCommand('docker', ['compose', '-f', COMPOSE_FILE, ...args], { cwd: ROOT_DIR });
}

async function createProxy(name, listen, upstream) {
  await httpJson(`http://127.0.0.1:8474/proxies/${name}`, {
    method: 'DELETE',
  });
  const response = await httpJson('http://127.0.0.1:8474/proxies', {
    method: 'POST',
    body: {
      name,
      listen,
      upstream,
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to create proxy ${name}: ${response.text}`);
  }
}

async function listProxyToxics(name) {
  const response = await httpJson(`http://127.0.0.1:8474/proxies/${name}`);
  if (!response.ok) {
    throw new Error(`Failed to inspect proxy ${name}: ${response.text}`);
  }
  return Array.isArray(response.json?.toxics) ? response.json.toxics : [];
}

async function resetProxyToxics(name) {
  const toxics = await listProxyToxics(name);
  for (const toxic of toxics) {
    await httpJson(`http://127.0.0.1:8474/proxies/${name}/toxics/${toxic.name}`, {
      method: 'DELETE',
    });
  }
}

async function addLatencyToxic(name, latencyMs, jitter = 100) {
  const response = await httpJson(`http://127.0.0.1:8474/proxies/${name}/toxics`, {
    method: 'POST',
    body: {
      name: 'latency',
      type: 'latency',
      stream: 'upstream',
      toxicity: 1,
      attributes: {
        latency: latencyMs,
        jitter,
      },
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to add latency toxic to ${name}: ${response.text}`);
  }
}

async function addTimeoutToxic(name, timeoutMs) {
  const response = await httpJson(`http://127.0.0.1:8474/proxies/${name}/toxics`, {
    method: 'POST',
    body: {
      name: 'timeout',
      type: 'timeout',
      stream: 'upstream',
      toxicity: 1,
      attributes: {
        timeout: timeoutMs,
      },
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to add timeout toxic to ${name}: ${response.text}`);
  }
}

async function configureToxiproxy() {
  await waitForHttpOk('http://127.0.0.1:8474/proxies', { timeoutMs: 30_000 });
  await createProxy('redis-runtime', '0.0.0.0:46379', 'redis:6379');
  await createProxy('dependency-runtime', '0.0.0.0:46460', 'host.docker.internal:4600');
}

async function buildAndPrepareBackend() {
  await runCmdScript(BACKEND_NEST_BIN, ['build'], {
    cwd: BACKEND_DIR,
  });
  await runCmdScript(BACKEND_PRISMA_BIN, ['migrate', 'deploy', '--schema', 'prisma/schema.prisma'], {
    cwd: BACKEND_DIR,
    env: {
      DATABASE_URL,
    },
  });
  await runCmdScript(BACKEND_TSX_BIN, ['prisma/seed.ts', 'deploy', '--force'], {
    cwd: BACKEND_DIR,
    env: {
      DATABASE_URL,
      INSTALL_ADMIN_PASSWORD: SUPERADMIN_PASSWORD,
      USER_DEFAULT_PASSWORD: SUPERADMIN_PASSWORD,
    },
  });
  await runCommand('docker', [
    'exec',
    'codex-distributed-postgres',
    'psql',
    '-U',
    'postgres',
    '-d',
    'runtimeproof',
    '-c',
    'INSERT INTO "security_config" ("id","rateLimitDevEnabled","globalMaxRequests","globalWindowMinutes") SELECT \'00000000-0000-0000-0000-000000000001\', TRUE, 10000, 1 WHERE NOT EXISTS (SELECT 1 FROM "security_config"); UPDATE "security_config" SET "rateLimitDevEnabled" = TRUE, "globalMaxRequests" = 10000, "globalWindowMinutes" = 1;',
  ]);
}

async function startDependencyStub() {
  const logFile = path.join(runtime.artifactsDir, 'dependency-stub.log');
  spawnLogged('dependency-stub', 'node', [DEPENDENCY_STUB_FILE], {
    cwd: ROOT_DIR,
    logFile,
  });
  await waitForLog(logFile, /listening on 127\.0\.0\.1:4600/i, 15_000);
}

async function startBackends() {
  for (const backend of BACKENDS) {
    const logFile = path.join(runtime.artifactsDir, `${backend.name}.log`);
    spawnLogged(backend.name, 'node', [BACKEND_MAIN_FILE], {
      cwd: BACKEND_DIR,
      logFile,
      env: buildBackendEnv(backend.port, backend.nodeAppInstance),
    });
    await waitForHttpOk(`${backend.baseUrl}/api/health`, {
      headers: { 'x-api-version': API_VERSION },
      timeoutMs: 60_000,
    });
  }
}

function generateValidCnpj(seed) {
  const digits = String(seed).replace(/\D/g, '').padStart(12, '0').slice(-12).split('').map(Number);
  const calc = (base, multipliers) => {
    const sum = base.reduce((acc, digit, index) => acc + digit * multipliers[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const d1 = calc(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc([...digits, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return [...digits, d1, d2].join('');
}

async function login(baseUrl, email, password) {
  const jar = new CookieJar();
  const response = await httpJson(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    jar,
    body: {
      email,
      password,
    },
  });
  if (!response.ok) {
    throw new Error(`Login failed for ${email}: ${response.status} ${response.text}`);
  }
  return jar;
}

async function createTenant(superadminJar, baseUrl, input) {
  const response = await httpJson(`${baseUrl}/api/tenants`, {
    method: 'POST',
    jar: superadminJar,
    body: input,
  });
  if (!response.ok) {
    throw new Error(`Tenant creation failed: ${response.status} ${response.text}`);
  }
  return response.json;
}

async function authenticatedRequest(baseUrl, routePath, options = {}) {
  return httpJson(`${baseUrl}${routePath}`, options);
}

function beginScenario(id, title) {
  const startedAt = Date.now();
  const logOffsets = {};
  for (const processEntry of runtime.processes) {
    try {
      logOffsets[processEntry.name] = fs.existsSync(processEntry.logFile)
        ? fs.statSync(processEntry.logFile).size
        : 0;
    } catch {
      logOffsets[processEntry.name] = 0;
    }
  }

  return {
    id,
    title,
    startedAt,
    commandsStartIndex: runtime.commands.length,
    logOffsets,
  };
}

async function finishScenario(context, data) {
  const logs = {};
  for (const processEntry of runtime.processes) {
    try {
      const buffer = await fsp.readFile(processEntry.logFile);
      const start = Math.min(context.logOffsets[processEntry.name] || 0, buffer.length);
      logs[processEntry.name] = buffer.toString('utf8', start);
    } catch {
      logs[processEntry.name] = '';
    }
  }

  const result = {
    id: context.id,
    title: context.title,
    startedAt: new Date(context.startedAt).toISOString(),
    finishedAt: nowIso(),
    durationMs: Date.now() - context.startedAt,
    commands: runtime.commands.slice(context.commandsStartIndex),
    logs,
    ...data,
  };
  runtime.scenarioResults.push(result);
  return result;
}

async function timedRequest(label, baseUrl, routePath, options = {}) {
  const sentAtMs = Date.now();
  const response = await authenticatedRequest(baseUrl, routePath, options);
  const completedAtMs = Date.now();
  const startedAtMs = response.json?.startedAt ? new Date(response.json.startedAt).getTime() : null;
  return {
    label,
    baseUrl,
    routePath,
    sentAt: new Date(sentAtMs).toISOString(),
    completedAt: new Date(completedAtMs).toISOString(),
    durationMs: completedAtMs - sentAtMs,
    queueWaitMs:
      startedAtMs && Number.isFinite(startedAtMs) ? Math.max(0, startedAtMs - sentAtMs) : null,
    status: response.status,
    ok: response.ok,
    headers: response.headers,
    body: response.json,
  };
}

function average(values) {
  if (!values.length) {
    return null;
  }
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function summarizeRequests(requests) {
  const durations = requests.map((entry) => entry.durationMs);
  const waits = requests
    .map((entry) => entry.queueWaitMs)
    .filter((value) => Number.isFinite(value));

  return {
    count: requests.length,
    avgDurationMs: average(durations),
    avgQueueWaitMs: average(waits),
    maxQueueWaitMs: waits.length > 0 ? Math.max(...waits) : null,
    rejected: requests.filter((entry) => !entry.ok).length,
  };
}

async function getClusterHealth(baseUrl, jar) {
  const response = await authenticatedRequest(baseUrl, '/api/ops-runtime-test/cluster/health', {
    method: 'GET',
    jar,
  });
  if (!response.ok) {
    throw new Error(`Cluster health failed at ${baseUrl}: ${response.status} ${response.text}`);
  }
  return response.json;
}

async function getDashboard(baseUrl, jar) {
  const response = await authenticatedRequest(
    baseUrl,
    '/api/system/dashboard?periodMinutes=60&severity=all',
    {
      method: 'GET',
      jar,
    },
  );
  if (!response.ok) {
    throw new Error(`Dashboard failed at ${baseUrl}: ${response.status} ${response.text}`);
  }
  return response.json;
}

async function configureDependencyStub(body) {
  const response = await httpJson('http://127.0.0.1:4600/admin/config', {
    method: 'POST',
    body,
  });
  if (!response.ok) {
    throw new Error(`Dependency stub config failed: ${response.text}`);
  }
}

async function resetDependencyStub() {
  const response = await httpJson('http://127.0.0.1:4600/admin/reset', {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Dependency stub reset failed: ${response.text}`);
  }
}

async function getDependencyStubRequests() {
  const response = await httpJson('http://127.0.0.1:4600/admin/requests');
  if (!response.ok) {
    throw new Error(`Dependency stub requests fetch failed: ${response.text}`);
  }
  return response.json;
}

async function setupPrincipals() {
  const superadminJar = await login(BACKENDS[0].baseUrl, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
  const tenantA = await createTenant(superadminJar, BACKENDS[0].baseUrl, {
    email: 'tenant-a@example.com',
    cnpjCpf: generateValidCnpj('111111111111'),
    nomeFantasia: 'Tenant A Runtime Proof',
    nomeResponsavel: 'Tenant A Responsavel',
    telefone: '(11) 90000-1001',
    adminEmail: TENANT_A_ADMIN_EMAIL,
    adminPassword: TENANT_A_ADMIN_PASSWORD,
    adminName: 'Tenant A Admin',
  });
  const tenantB = await createTenant(superadminJar, BACKENDS[0].baseUrl, {
    email: 'tenant-b@example.com',
    cnpjCpf: generateValidCnpj('222222222222'),
    nomeFantasia: 'Tenant B Runtime Proof',
    nomeResponsavel: 'Tenant B Responsavel',
    telefone: '(11) 90000-1002',
    adminEmail: TENANT_B_ADMIN_EMAIL,
    adminPassword: TENANT_B_ADMIN_PASSWORD,
    adminName: 'Tenant B Admin',
  });

  const tenantAJar = await login(BACKENDS[0].baseUrl, TENANT_A_ADMIN_EMAIL, TENANT_A_ADMIN_PASSWORD);
  const tenantBJar = await login(BACKENDS[0].baseUrl, TENANT_B_ADMIN_EMAIL, TENANT_B_ADMIN_PASSWORD);

  return {
    superadminJar,
    tenantA,
    tenantB,
    tenantAJar,
    tenantBJar,
  };
}

async function runFairnessScenario(principals) {
  const context = beginScenario('fairness-global', 'Fairness global por tenant');
  const midFlightPromise = delay(350).then(async () => ({
    healthA: await getClusterHealth(BACKENDS[0].baseUrl, principals.superadminJar),
    healthB: await getClusterHealth(BACKENDS[1].baseUrl, principals.superadminJar),
  }));

  const tenantARequests = Array.from({ length: 6 }, (_, index) =>
    timedRequest(
      `tenant-a-${index + 1}`,
      BACKENDS[index % BACKENDS.length].baseUrl,
      '/api/ops-runtime-test/fair-queue/hold?holdMs=1200',
      {
        method: 'POST',
        jar: principals.tenantAJar,
      },
    ),
  );
  const tenantBRequests = Array.from({ length: 3 }, (_, index) =>
    timedRequest(
      `tenant-b-${index + 1}`,
      BACKENDS[(index + 1) % BACKENDS.length].baseUrl,
      '/api/ops-runtime-test/fair-queue/hold?holdMs=600',
      {
        method: 'POST',
        jar: principals.tenantBJar,
      },
    ),
  );

  const allRequests = await Promise.all([...tenantARequests, ...tenantBRequests]);
  const midFlight = await midFlightPromise;
  const tenantAResults = allRequests.filter((entry) => entry.label.startsWith('tenant-a-'));
  const tenantBResults = allRequests.filter((entry) => entry.label.startsWith('tenant-b-'));
  const orderedStarts = allRequests
    .filter((entry) => entry.body?.startedAt)
    .map((entry) => ({
      label: entry.label,
      startedAt: entry.body.startedAt,
      tenantId: entry.body.tenantId,
      instanceId: entry.body.instanceId,
    }))
    .sort((left, right) => new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime());

  const firstBIndex = orderedStarts.findIndex((entry) => entry.label.startsWith('tenant-b-'));
  const lastAIndex = orderedStarts.reduce(
    (latest, entry, index) => (entry.label.startsWith('tenant-a-') ? index : latest),
    -1,
  );

  return finishScenario(context, {
    instanceCount: BACKENDS.length,
    loadApplied: {
      tenantA: { concurrency: 6, holdMs: 1200 },
      tenantB: { concurrency: 3, holdMs: 600 },
    },
    expected: 'Tenant B deve receber grants antes de Tenant A consumir toda a fila.',
    observed: {
      tenantA: summarizeRequests(tenantAResults),
      tenantB: summarizeRequests(tenantBResults),
      orderedStarts,
      tenantBStartedBeforeTenantAExhaustedQueue:
        firstBIndex !== -1 && lastAIndex !== -1 && firstBIndex < lastAIndex,
      midFlightQueue: {
        backendA: midFlight.healthA.queue.fairQueue,
        backendB: midFlight.healthB.queue.fairQueue,
      },
    },
  });
}

async function runRedisUnavailableScenario(principals) {
  const context = beginScenario('redis-unavailable', 'Redis indisponivel em trafego real');
  await dockerCompose(['stop', 'redis']);
  await delay(3_000);

  const degradedHealthA = await getClusterHealth(BACKENDS[0].baseUrl, principals.superadminJar);
  const degradedHealthB = await getClusterHealth(BACKENDS[1].baseUrl, principals.superadminJar);
  const dashboard = await getDashboard(BACKENDS[0].baseUrl, principals.superadminJar);
  const alerts = await authenticatedRequest(
    BACKENDS[0].baseUrl,
    '/api/ops-runtime-test/alerts/evaluate',
    {
      method: 'GET',
      jar: principals.superadminJar,
    },
  );

  const sameTenantRequests = await Promise.all([
    timedRequest(
      'tenant-a-down-a',
      BACKENDS[0].baseUrl,
      '/api/ops-runtime-test/fair-queue/hold?holdMs=1200',
      { method: 'POST', jar: principals.tenantAJar },
    ),
    timedRequest(
      'tenant-a-down-b',
      BACKENDS[1].baseUrl,
      '/api/ops-runtime-test/fair-queue/hold?holdMs=1200',
      { method: 'POST', jar: principals.tenantAJar },
    ),
  ]);

  await dockerCompose(['start', 'redis']);
  await waitForRedisHealthy().catch(() => null);
  await delay(4_000);

  return finishScenario(context, {
    instanceCount: BACKENDS.length,
    loadApplied: {
      sameTenantConcurrentRequests: 2,
      holdMs: 1200,
    },
    expected:
      'Cluster deve entrar em modo degradado explicito, expor fallbackActive/detail e nao fingir coordenacao global.',
    observed: {
      backendA: degradedHealthA.redis,
      backendB: degradedHealthB.redis,
      dashboardRedis: dashboard.redis,
      alerts: alerts.json,
      sameTenantRequests,
      simultaneousStartDeltaMs: Math.abs(
        new Date(sameTenantRequests[0].body.startedAt).getTime() -
          new Date(sameTenantRequests[1].body.startedAt).getTime(),
      ),
    },
  });
}

async function runRedisIntermittentScenario(principals) {
  const context = beginScenario('redis-intermittent', 'Redis lento e intermitente via Toxiproxy');
  await resetProxyToxics('redis-runtime');
  await addLatencyToxic('redis-runtime', 1500, 200);
  await addTimeoutToxic('redis-runtime', 900);
  await delay(2_000);

  const fairQueueTraffic = await Promise.all(
    Array.from({ length: 4 }, (_, index) =>
      timedRequest(
        `intermittent-${index + 1}`,
        BACKENDS[index % BACKENDS.length].baseUrl,
        '/api/ops-runtime-test/fair-queue/hold?holdMs=700',
        {
          method: 'POST',
          jar: principals.tenantAJar,
        },
      ),
    ),
  );

  const healthA = await getClusterHealth(BACKENDS[0].baseUrl, principals.superadminJar);
  const healthB = await getClusterHealth(BACKENDS[1].baseUrl, principals.superadminJar);
  const dashboard = await getDashboard(BACKENDS[0].baseUrl, principals.superadminJar);

  await resetProxyToxics('redis-runtime');
  await delay(4_000);

  return finishScenario(context, {
    instanceCount: BACKENDS.length,
    loadApplied: {
      redisLatencyMs: 1500,
      redisTimeoutMs: 900,
      trafficRequests: 4,
    },
    expected:
      'Health snapshot e payload operacional devem refletir latencia/falha Redis com degradacao explicita.',
    observed: {
      traffic: fairQueueTraffic,
      backendA: healthA.redis,
      backendB: healthB.redis,
      dashboardRedis: dashboard.redis,
      stateConsistency: {
        backendA: healthA.loadShedding.stateConsistency,
        backendB: healthB.loadShedding.stateConsistency,
      },
    },
  });
}

async function runBreakerQuorumScenario(principals) {
  const context = beginScenario('breaker-quorum', 'Breaker distribuido com quorum');
  await resetDependencyStub();
  await configureDependencyStub({
    mode: 'error',
    delayMs: 0,
    statusCode: 503,
  });

  const failureA = await authenticatedRequest(
    BACKENDS[0].baseUrl,
    '/api/ops-runtime-test/dependency/check?timeoutMs=1200',
    { method: 'GET', jar: principals.superadminJar },
  );
  const failureB = await authenticatedRequest(
    BACKENDS[1].baseUrl,
    '/api/ops-runtime-test/dependency/check?timeoutMs=1200',
    { method: 'GET', jar: principals.superadminJar },
  );
  const openA = await authenticatedRequest(
    BACKENDS[0].baseUrl,
    '/api/ops-runtime-test/dependency/check?timeoutMs=1200',
    { method: 'GET', jar: principals.superadminJar },
  );

  await delay(4_500);
  await configureDependencyStub({
    mode: 'ok',
    delayMs: 0,
    statusCode: 200,
  });

  const recoveryProbeA = await authenticatedRequest(
    BACKENDS[0].baseUrl,
    '/api/ops-runtime-test/dependency/check?timeoutMs=1200',
    { method: 'GET', jar: principals.superadminJar },
  );
  const recoveryProbeB = await authenticatedRequest(
    BACKENDS[1].baseUrl,
    '/api/ops-runtime-test/dependency/check?timeoutMs=1200',
    { method: 'GET', jar: principals.superadminJar },
  );
  const recovered = await authenticatedRequest(
    BACKENDS[0].baseUrl,
    '/api/ops-runtime-test/dependency/check?timeoutMs=1200',
    { method: 'GET', jar: principals.superadminJar },
  );

  return finishScenario(context, {
    instanceCount: BACKENDS.length,
    expected:
      'Uma falha isolada nao deve abrir circuito; duas instancias votando devem abrir, half-open deve permitir probes limitados e recuperar gradualmente.',
    observed: {
      firstFailure: failureA.json,
      secondFailure: failureB.json,
      circuitOpen: openA.json,
      recoveryProbeA: recoveryProbeA.json,
      recoveryProbeB: recoveryProbeB.json,
      recovered: recovered.json,
    },
  });
}

async function runGranularSheddingScenario(principals) {
  const context = beginScenario('granular-shedding', 'Shedding granular por tenant e rota');
  const hammerResults = await Promise.all(
    Array.from({ length: 10 }, (_, index) =>
      timedRequest(
        `granular-tenant-a-${index + 1}`,
        BACKENDS[index % BACKENDS.length].baseUrl,
        '/api/ops-runtime-test/fair-queue/hold?holdMs=900',
        {
          method: 'POST',
          jar: principals.tenantAJar,
        },
      ),
    ),
  );

  await delay(750);

  const tenantAContext = await authenticatedRequest(
    BACKENDS[0].baseUrl,
    '/api/ops-runtime-test/shedding/context?path=/api/ops-runtime-test/fair-queue/hold',
    {
      method: 'GET',
      jar: principals.tenantAJar,
    },
  );
  const tenantBContext = await authenticatedRequest(
    BACKENDS[0].baseUrl,
    '/api/ops-runtime-test/shedding/context?path=/api/ops-runtime-test/fair-queue/hold',
    {
      method: 'GET',
      jar: principals.tenantBJar,
    },
  );

  return finishScenario(context, {
    instanceCount: BACKENDS.length,
    loadApplied: {
      tenantAHammerRequests: hammerResults.length,
      route: '/api/ops-runtime-test/fair-queue/hold',
      holdMs: 900,
    },
    expected:
      'Tenant pesado deve receber factor reduzido e causa tenant-route, enquanto tenant leve permanece sem penalizacao injusta.',
    observed: {
      hammer: {
        total: hammerResults.length,
        blocked: hammerResults.filter((entry) => entry.status === 429).length,
        avgQueueWaitMs: average(
          hammerResults.map((entry) => entry.queueWaitMs).filter(Number.isFinite),
        ),
        maxQueueWaitMs: Math.max(
          0,
          ...hammerResults.map((entry) =>
            Number.isFinite(entry.queueWaitMs) ? entry.queueWaitMs : 0,
          ),
        ),
      },
      tenantAContext: tenantAContext.json,
      tenantBContext: tenantBContext.json,
    },
  });
}

async function sampleHealthSeries(jar, seconds) {
  const samples = [];
  for (let index = 0; index < seconds; index += 1) {
    const health = await getClusterHealth(BACKENDS[0].baseUrl, jar);
    samples.push({
      at: nowIso(),
      adaptiveThrottleFactor: health.loadShedding.adaptiveThrottleFactor,
      desiredAdaptiveThrottleFactor: health.loadShedding.desiredAdaptiveThrottleFactor,
      pressureCause: health.loadShedding.pressureCause,
      clusterRecentApiLatencyMs: health.loadShedding.clusterRecentApiLatencyMs,
      clusterQueueDepth: health.loadShedding.clusterQueueDepth,
      featureFlags: health.loadShedding.mitigation.featureFlags,
    });
    await delay(1_000);
  }
  return samples;
}

async function runAdaptiveRateLimitScenario(principals) {
  const context = beginScenario(
    'adaptive-rate-limit',
    'Throttling adaptativo com smoothing e hysteresis',
  );

  const loadWave = Promise.all(
    Array.from({ length: 10 }, (_, index) =>
      timedRequest(
        `adaptive-wave-${index + 1}`,
        BACKENDS[index % BACKENDS.length].baseUrl,
        '/api/ops-runtime-test/fair-queue/hold?holdMs=1400',
        {
          method: 'POST',
          jar: principals.tenantAJar,
        },
      ),
    ),
  );

  await delay(250);
  const [underLoadSamples, underLoadRateLimitBodies] = await Promise.all([
    sampleHealthSeries(principals.superadminJar, 6),
    sampleRateLimitBodies(principals.tenantAJar, 6, 450),
  ]);
  await loadWave;
  const recoverySamples = await sampleHealthSeries(principals.superadminJar, 5);
  const recoveryRateLimitBodies = await sampleRateLimitBodies(principals.tenantAJar, 4, 250);

  return finishScenario(context, {
    instanceCount: BACKENDS.length,
    loadApplied: {
      heavyQueuedRequests: 10,
      holdMs: 1400,
    },
    expected:
      'Adaptive factor deve cair com suavizacao, nao oscilar agressivamente e recuperar de forma gradual apos estabilidade.',
    observed: {
      underLoadSamples,
      recoverySamples,
      underLoadRateLimitBodies,
      recoveryRateLimitBodies,
    },
  });
}

async function runTraceBaggageScenario(principals) {
  const context = beginScenario('trace-baggage', 'Trace e baggage sob controle');
  await Promise.all(
    Array.from({ length: 4 }, (_, index) =>
      authenticatedRequest(
        BACKENDS[index % BACKENDS.length].baseUrl,
        '/api/ops-runtime-test/runtime/slow?delayMs=1800',
        {
          method: 'GET',
          jar: principals.tenantAJar,
        },
      ),
    ),
  );
  await delay(1_500);
  const dependencyResponse = await authenticatedRequest(
    BACKENDS[0].baseUrl,
    '/api/ops-runtime-test/dependency/check?timeoutMs=1500',
    {
      method: 'GET',
      jar: principals.tenantAJar,
    },
  );
  const dependencyRequests = await getDependencyStubRequests();
  const lastRequest = dependencyRequests.recentRequests[dependencyRequests.recentRequests.length - 1] || null;

  return finishScenario(context, {
    instanceCount: BACKENDS.length,
    expected:
      'Traceparent e baggage devem ser propagados com tenantId, userId, apiVersion e flags sem ultrapassar o limite configurado.',
    observed: {
      dependencyResponse: dependencyResponse.json,
      stubObserved: lastRequest,
      baggageUnderControl: Boolean(lastRequest && lastRequest.baggageBytes <= 160),
    },
  });
}

async function sampleRateLimitBodies(jar, count, intervalMs) {
  const samples = [];

  for (let index = 0; index < count; index += 1) {
    if (index > 0) {
      await delay(intervalMs);
    }

    const response = await authenticatedRequest(
      BACKENDS[index % BACKENDS.length].baseUrl,
      '/api/ops-runtime-test/rate-limit/ping',
      {
        method: 'GET',
        jar,
      },
    );

    samples.push({
      at: nowIso(),
      status: response.status,
      adaptiveFactor: response.json?.adaptiveFactor ?? null,
      pressureCause: response.json?.pressureCause ?? null,
      routePolicyId: response.json?.routePolicyId ?? null,
    });
  }

  return samples;
}

async function runSlowSuccessScenario(principals) {
  const context = beginScenario('slow-success', 'Sucesso lento com visibilidade operacional');
  const responses = await Promise.all(
    Array.from({ length: 5 }, (_, index) =>
      authenticatedRequest(
        BACKENDS[index % BACKENDS.length].baseUrl,
        '/api/ops-runtime-test/runtime/slow?delayMs=2000',
        {
          method: 'GET',
          jar: principals.superadminJar,
        },
      ),
    ),
  );
  await delay(1_000);
  const health = await getClusterHealth(BACKENDS[0].baseUrl, principals.superadminJar);
  const alerts = await authenticatedRequest(
    BACKENDS[0].baseUrl,
    '/api/ops-runtime-test/alerts/evaluate',
    {
      method: 'GET',
      jar: principals.superadminJar,
    },
  );

  return finishScenario(context, {
    instanceCount: BACKENDS.length,
    loadApplied: {
      slowRequests: responses.length,
      delayMs: 2000,
    },
    expected:
      'Sucesso lento deve aparecer em telemetria operacional, aumentar latencia percebida e influenciar mitigacao/alerta.',
    observed: {
      responses: responses.map((entry) => ({
        status: entry.status,
        durationMs: entry.json?.configuredDelayMs || null,
      })),
      operationalTelemetry: health.telemetry.operational,
      loadShedding: health.loadShedding,
      alerts: alerts.json,
    },
  });
}

async function runSimultaneousFailureScenario(principals) {
  const context = beginScenario('simultaneous-failure', 'Falha simultanea sob carga alta');
  await resetProxyToxics('redis-runtime');
  await configureDependencyStub({
    mode: 'error',
    delayMs: 200,
    statusCode: 503,
  });
  await addLatencyToxic('redis-runtime', 1200, 150);

  const queueLoad = Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      timedRequest(
        `sim-queue-${index + 1}`,
        BACKENDS[index % BACKENDS.length].baseUrl,
        '/api/ops-runtime-test/fair-queue/hold?holdMs=1000',
        {
          method: 'POST',
          jar: principals.tenantAJar,
        },
      ),
    ),
  );
  const rateLoad = Promise.all(
    Array.from({ length: 18 }, (_, index) =>
      authenticatedRequest(
        BACKENDS[index % BACKENDS.length].baseUrl,
        '/api/ops-runtime-test/rate-limit/ping',
        {
          method: 'GET',
          jar: principals.tenantAJar,
        },
      ),
    ),
  );
  const dependencyChecks = Promise.all(
    Array.from({ length: 4 }, (_, index) =>
      authenticatedRequest(
        BACKENDS[index % BACKENDS.length].baseUrl,
        '/api/ops-runtime-test/dependency/check?timeoutMs=1000',
        {
          method: 'GET',
          jar: principals.superadminJar,
        },
      ),
    ),
  );

  const [queueResults, rateResults, dependencyResults] = await Promise.all([
    queueLoad,
    rateLoad,
    dependencyChecks,
  ]);
  const health = await getClusterHealth(BACKENDS[0].baseUrl, principals.superadminJar);
  const dashboard = await getDashboard(BACKENDS[0].baseUrl, principals.superadminJar);
  const alerts = await authenticatedRequest(
    BACKENDS[0].baseUrl,
    '/api/ops-runtime-test/alerts/evaluate',
    {
      method: 'GET',
      jar: principals.superadminJar,
    },
  );

  await resetProxyToxics('redis-runtime');
  await resetDependencyStub();
  await delay(4_000);

  return finishScenario(context, {
    instanceCount: BACKENDS.length,
    loadApplied: {
      queueRequests: queueResults.length,
      rateRequests: rateResults.length,
      dependencyChecks: dependencyResults.length,
      redisLatencyMs: 1200,
      dependencyFailureStatus: 503,
    },
    expected:
      'Cluster deve degradar de forma controlada, expor mitigacao/alertas e evitar comportamento caotico sob falha combinada.',
    observed: {
      queue: summarizeRequests(queueResults),
      rateLimited: rateResults.filter((entry) => entry.status === 429).length,
      dependencyModes: dependencyResults.map((entry) => entry.json?.mode || null),
      loadShedding: health.loadShedding,
      redis: health.redis,
      dashboardRuntimeMitigation: dashboard.runtimeMitigation,
      dashboardRedis: dashboard.redis,
      alerts: alerts.json,
    },
  });
}

function renderReport(results, setup) {
  const lines = [];
  lines.push('# Distributed Runtime Proof');
  lines.push('');
  lines.push(`Gerado em: ${nowIso()}`);
  lines.push('');
  lines.push('## Ambiente');
  lines.push('');
  lines.push(`- Instancias backend: ${BACKENDS.map((entry) => `${entry.name} (${entry.baseUrl})`).join(', ')}`);
  lines.push('- Redis: Docker + Toxiproxy');
  lines.push('- Postgres: Docker');
  lines.push('- Dependency stub: host local em 127.0.0.1:4600');
  lines.push(`- Tenant A: ${setup.tenantA.id}`);
  lines.push(`- Tenant B: ${setup.tenantB.id}`);
  lines.push('');
  for (const result of results) {
    lines.push(`## ${result.id}`);
    lines.push('');
    lines.push(`- Titulo: ${result.title}`);
    lines.push(`- Duracao: ${result.durationMs} ms`);
    lines.push(`- Esperado: ${result.expected}`);
    lines.push('- Observado:');
    lines.push('```json');
    lines.push(JSON.stringify(result.observed, null, 2));
    lines.push('```');
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

async function waitForRedisHealthy() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const result = await runCommand(
      'docker',
      ['exec', 'codex-distributed-redis', 'redis-cli', 'ping'],
      {
        cwd: ROOT_DIR,
        allowFailure: true,
      },
    );
    if (result.code === 0 && /PONG/i.test(result.stdout)) {
      return;
    }
    await delay(500);
  }
  throw new Error('Timed out waiting for Redis health');
}

async function waitForPostgresHealthy() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const result = await runCommand(
      'docker',
      ['exec', 'codex-distributed-postgres', 'pg_isready', '-U', 'postgres', '-d', 'runtimeproof'],
      {
        cwd: ROOT_DIR,
        allowFailure: true,
      },
    );
    if (result.code === 0 && /accepting connections/i.test(result.stdout)) {
      return;
    }
    await delay(1_000);
  }
  throw new Error('Timed out waiting for Postgres health');
}

async function prepareInfrastructure() {
  await dockerCompose(['down', '-v', '--remove-orphans']);
  await dockerCompose(['up', '-d']);
  await waitForRedisHealthy();
  await waitForPostgresHealthy();
}

async function cleanup() {
  for (const entry of runtime.processes.splice(0).reverse()) {
    try {
      entry.child.kill();
    } catch {}
    try {
      entry.stream.end();
    } catch {}
  }

  try {
    await dockerCompose(['down', '-v', '--remove-orphans']);
  } catch {}
}

async function main() {
  runtime.artifactsDir = path.join(RESULTS_ROOT, slugTimestamp());
  await ensureDir(runtime.artifactsDir);

  let setup = null;
  try {
    await prepareInfrastructure();
    await startDependencyStub();
    await configureToxiproxy();
    await buildAndPrepareBackend();
    await startBackends();
    setup = await setupPrincipals();

    await runFairnessScenario(setup);
    await runRedisUnavailableScenario(setup);
    await runRedisIntermittentScenario(setup);
    await runBreakerQuorumScenario(setup);
    await runGranularSheddingScenario(setup);
    await runAdaptiveRateLimitScenario(setup);
    await runTraceBaggageScenario(setup);
    await runSlowSuccessScenario(setup);
    await runSimultaneousFailureScenario(setup);

    const report = renderReport(runtime.scenarioResults, setup);
    await writeJson(path.join(runtime.artifactsDir, 'results.json'), {
      generatedAt: nowIso(),
      artifactsDir: runtime.artifactsDir,
      commands: runtime.commands,
      setup,
      scenarios: runtime.scenarioResults,
    });
    await fsp.writeFile(path.join(runtime.artifactsDir, 'report.md'), report, 'utf8');
    process.stdout.write(`${path.join(runtime.artifactsDir, 'report.md')}\n`);
  } catch (error) {
    const errorPayload = {
      generatedAt: nowIso(),
      artifactsDir: runtime.artifactsDir,
      commands: runtime.commands,
      setup,
      scenarios: runtime.scenarioResults,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    };
    await writeJson(path.join(runtime.artifactsDir, 'failure.json'), errorPayload);
    throw error;
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exit(1);
});
