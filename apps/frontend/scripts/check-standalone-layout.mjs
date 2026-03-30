import { existsSync, readFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(scriptDir, '..');
const resolverScriptPath = path.join(frontendDir, 'scripts', 'start-standalone.mjs');
const canonicalEntryRelativePath = path.join('.next', 'standalone', 'apps', 'frontend', 'server.js');
const canonicalRuntimeDirRelativePath = path.join('.next', 'standalone', 'apps', 'frontend');
const canonicalBuildDirRelativePath = path.join('.next', 'standalone', 'apps', 'frontend', '.next');
const contaminatedStandaloneDirRelativePath = path.join('.next', 'standalone', 'releases');
const requiredServerFilesRelativePath = path.join('.next', 'required-server-files.json');
const canonicalRelativeAppDir = path.join('apps', 'frontend');
const expectedLayoutOutput = [
  'required-server-files',
  toPortablePath(canonicalEntryRelativePath),
  toPortablePath(canonicalRuntimeDirRelativePath),
  toPortablePath(canonicalBuildDirRelativePath),
].join('|');
const defaultSmokePort = 5100;
const defaultSmokeTimeoutMs = 12_000;

function toAbsolutePath(relativePath) {
  return path.join(frontendDir, relativePath);
}

function toPortablePath(value) {
  return value.split(path.sep).join('/');
}

function fail(message) {
  console.error(`ERRO: ${message}`);
  process.exit(1);
}

function logSuccess(message) {
  console.log(`OK: ${message}`);
}

function normalizeRelativeAppDir(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = path
    .normalize(value)
    .replace(/^[A-Za-z]:[\\/]/, '')
    .replace(/^([.][\\/])+/, '')
    .replace(/^[\\/]+/, '')
    .replace(/[\\/]+$/, '');

  if (!normalized || normalized === '.') {
    return null;
  }

  return normalized;
}

function resolveSmokePort() {
  const rawPort = String(process.env.STANDALONE_SMOKE_PORT || defaultSmokePort).trim();
  const parsedPort = Number(rawPort);

  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65_535) {
    throw new Error(`Porta de smoke invalida: ${rawPort}.`);
  }

  return parsedPort;
}

function resolveSmokeTimeoutMs() {
  const rawTimeout = String(process.env.STANDALONE_SMOKE_TIMEOUT_MS || defaultSmokeTimeoutMs).trim();
  const parsedTimeout = Number(rawTimeout);

  if (!Number.isInteger(parsedTimeout) || parsedTimeout < 1) {
    throw new Error(`Timeout de smoke invalido: ${rawTimeout}.`);
  }

  return parsedTimeout;
}

function validateCanonicalLayout() {
  const canonicalEntryAbsolutePath = toAbsolutePath(canonicalEntryRelativePath);
  if (!existsSync(canonicalEntryAbsolutePath)) {
    throw new Error(`Entrypoint standalone canonico ausente em ${canonicalEntryAbsolutePath}.`);
  }

  const contaminatedStandaloneDirAbsolutePath = toAbsolutePath(contaminatedStandaloneDirRelativePath);
  if (existsSync(contaminatedStandaloneDirAbsolutePath)) {
    throw new Error(`Diretorio contaminado detectado em ${contaminatedStandaloneDirAbsolutePath}.`);
  }

  const requiredServerFilesAbsolutePath = toAbsolutePath(requiredServerFilesRelativePath);
  if (!existsSync(requiredServerFilesAbsolutePath)) {
    throw new Error(`Arquivo obrigatorio ausente: ${requiredServerFilesAbsolutePath}.`);
  }

  let parsedRequiredServerFiles;
  try {
    parsedRequiredServerFiles = JSON.parse(readFileSync(requiredServerFilesAbsolutePath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Nao foi possivel ler ${requiredServerFilesAbsolutePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const relativeAppDir = normalizeRelativeAppDir(parsedRequiredServerFiles?.relativeAppDir);
  if (!relativeAppDir) {
    throw new Error(`required-server-files.json nao informou relativeAppDir valido em ${requiredServerFilesAbsolutePath}.`);
  }

  if (path.normalize(relativeAppDir) !== path.normalize(canonicalRelativeAppDir)) {
    throw new Error(
      `required-server-files.json informou relativeAppDir invalido (${toPortablePath(relativeAppDir)}). Esperado: ${toPortablePath(canonicalRelativeAppDir)}.`,
    );
  }

  const resolvedLayout = spawnSync(process.execPath, [resolverScriptPath, '--print-layout'], {
    cwd: frontendDir,
    encoding: 'utf8',
  });

  if (resolvedLayout.status !== 0) {
    const resolverFailureDetail =
      resolvedLayout.error?.message ||
      String(resolvedLayout.stderr || resolvedLayout.stdout || '').trim() ||
      `exit code ${resolvedLayout.status}`;
    throw new Error(
      `O resolver do standalone falhou: ${resolverFailureDetail}.`,
    );
  }

  const observedLayout = String(resolvedLayout.stdout || '').trim();
  if (observedLayout !== expectedLayoutOutput) {
    throw new Error(
      `O resolver do standalone retornou layout divergente. Esperado: ${expectedLayoutOutput}. Recebido: ${observedLayout || 'vazio'}.`,
    );
  }

  logSuccess(`Layout standalone canonico validado em ${canonicalEntryAbsolutePath}.`);
  return canonicalEntryAbsolutePath;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function formatChildFailureContext(stderrBuffer, childError) {
  const childErrorMessage = childError instanceof Error ? childError.message.trim() : '';
  const stderrMessage = String(stderrBuffer || '').trim();
  const details = [childErrorMessage, stderrMessage].filter(Boolean);
  return details.length > 0 ? ` Detalhes: ${details.join(' | ')}` : '';
}

async function stopChildProcess(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    sleep(2_000),
  ]);

  if (child.exitCode === null) {
    child.kill('SIGKILL');
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      sleep(2_000),
    ]);
  }
}

async function assertSmokePortIsFree(port) {
  await new Promise((resolve, reject) => {
    const probe = createServer();

    probe.once('error', (error) => {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'EADDRINUSE') {
        reject(new Error(`Porta de smoke ${port} ja esta em uso.`));
        return;
      }

      reject(new Error(`Nao foi possivel validar a porta de smoke ${port}: ${error instanceof Error ? error.message : String(error)}`));
    });

    probe.listen(port, '127.0.0.1', () => {
      probe.close((error) => {
        if (error) {
          reject(new Error(`Nao foi possivel liberar a sonda da porta de smoke ${port}: ${error.message}`));
          return;
        }

        resolve(undefined);
      });
    });
  });

  logSuccess(`Porta de smoke ${port} livre.`);
}

function registerInterruptionCleanup(child) {
  let handled = false;

  const handleSignal = (signal) => {
    if (handled) {
      return;
    }

    handled = true;
    void (async () => {
      try {
        await stopChildProcess(child);
      } finally {
        console.error(`ERRO: Smoke do standalone interrompido por ${signal}.`);
        process.exit(1);
      }
    })();
  };

  process.once('SIGINT', handleSignal);
  process.once('SIGTERM', handleSignal);

  return () => {
    process.removeListener('SIGINT', handleSignal);
    process.removeListener('SIGTERM', handleSignal);
  };
}

async function runSmokeTest(canonicalEntryAbsolutePath) {
  const port = resolveSmokePort();
  const timeoutMs = resolveSmokeTimeoutMs();
  const healthcheckUrl = `http://127.0.0.1:${port}/api/health`;

  await assertSmokePortIsFree(port);

  const child = spawn(process.execPath, [canonicalEntryAbsolutePath], {
    cwd: frontendDir,
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: process.env.HOSTNAME || '127.0.0.1',
      NODE_ENV: 'production',
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  const unregisterInterruptionCleanup = registerInterruptionCleanup(child);
  let childError = null;
  let stderrBuffer = '';
  child.once('error', (error) => {
    childError = error;
  });
  child.stderr?.on('data', (chunk) => {
    stderrBuffer = `${stderrBuffer}${chunk.toString()}`.slice(-4_000);
  });

  logSuccess(`Standalone iniciado para smoke test em ${healthcheckUrl}.`);

  try {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      if (childError) {
        throw new Error(`Falha ao iniciar o frontend standalone.${formatChildFailureContext(stderrBuffer, childError)}`);
      }

      if (child.exitCode !== null) {
        throw new Error(
          `O frontend standalone encerrou antes do healthcheck. Exit code: ${child.exitCode}.${formatChildFailureContext(stderrBuffer, childError)}`,
        );
      }

      try {
        const response = await fetch(healthcheckUrl);
        if (!response.ok) {
          throw new Error(`Healthcheck respondeu com status inesperado: ${response.status}.`);
        }

        const payload = await response.json();
        if (payload?.status !== 'ok') {
          throw new Error(`Healthcheck respondeu com payload inesperado: ${JSON.stringify(payload)}.`);
        }

        logSuccess(`Smoke do standalone aprovado em ${healthcheckUrl}.`);
        return;
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('Healthcheck respondeu')) {
          throw error;
        }

        await sleep(500);
      }
    }

    throw new Error(`Timeout aguardando healthcheck do standalone em ${healthcheckUrl}.`);
  } finally {
    unregisterInterruptionCleanup();
    await stopChildProcess(child);
  }
}

try {
  const shouldRunSmoke = process.argv.includes('--smoke');
  const canonicalEntryAbsolutePath = validateCanonicalLayout();

  if (shouldRunSmoke) {
    await runSmokeTest(canonicalEntryAbsolutePath);
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
