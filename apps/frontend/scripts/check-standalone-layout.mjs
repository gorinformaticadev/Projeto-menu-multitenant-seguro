import { existsSync, readFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
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

function validateCanonicalLayout() {
  const canonicalEntryAbsolutePath = toAbsolutePath(canonicalEntryRelativePath);
  if (!existsSync(canonicalEntryAbsolutePath)) {
    fail(`Entrypoint standalone canonico ausente em ${canonicalEntryAbsolutePath}.`);
  }

  const contaminatedStandaloneDirAbsolutePath = toAbsolutePath(contaminatedStandaloneDirRelativePath);
  if (existsSync(contaminatedStandaloneDirAbsolutePath)) {
    fail(`Diretorio contaminado detectado em ${contaminatedStandaloneDirAbsolutePath}.`);
  }

  const requiredServerFilesAbsolutePath = toAbsolutePath(requiredServerFilesRelativePath);
  if (!existsSync(requiredServerFilesAbsolutePath)) {
    fail(`Arquivo obrigatorio ausente: ${requiredServerFilesAbsolutePath}.`);
  }

  let parsedRequiredServerFiles;
  try {
    parsedRequiredServerFiles = JSON.parse(readFileSync(requiredServerFilesAbsolutePath, 'utf8'));
  } catch (error) {
    fail(
      `Nao foi possivel ler ${requiredServerFilesAbsolutePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const relativeAppDir = normalizeRelativeAppDir(parsedRequiredServerFiles?.relativeAppDir);
  if (!relativeAppDir) {
    fail(`required-server-files.json nao informou relativeAppDir valido em ${requiredServerFilesAbsolutePath}.`);
  }

  if (path.normalize(relativeAppDir) !== path.normalize(canonicalRelativeAppDir)) {
    fail(
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
    fail(
      `O resolver do standalone falhou: ${resolverFailureDetail}.`,
    );
  }

  const observedLayout = String(resolvedLayout.stdout || '').trim();
  if (observedLayout !== expectedLayoutOutput) {
    fail(
      `O resolver do standalone retornou layout divergente. Esperado: ${expectedLayoutOutput}. Recebido: ${observedLayout || 'vazio'}.`,
    );
  }

  logSuccess(`Layout standalone canonico validado em ${canonicalEntryAbsolutePath}.`);
  return canonicalEntryAbsolutePath;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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

async function runSmokeTest(canonicalEntryAbsolutePath) {
  const port = String(process.env.STANDALONE_SMOKE_PORT || '5100').trim() || '5100';
  const child = spawn(process.execPath, [canonicalEntryAbsolutePath], {
    cwd: frontendDir,
    env: {
      ...process.env,
      PORT: port,
      HOSTNAME: process.env.HOSTNAME || '127.0.0.1',
      NODE_ENV: 'production',
    },
    stdio: 'ignore',
  });

  let lastError = null;

  try {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (child.exitCode !== null) {
        fail(`O standalone encerrou antes do smoke test concluir. Exit code: ${child.exitCode}.`);
      }

      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/health`);
        if (!response.ok) {
          throw new Error(`status HTTP ${response.status}`);
        }

        const payload = await response.json();
        if (payload?.status !== 'ok') {
          throw new Error(`payload inesperado: ${JSON.stringify(payload)}`);
        }

        logSuccess(`Smoke do standalone aprovado em http://127.0.0.1:${port}/api/health.`);
        return;
      } catch (error) {
        lastError = error;
        await sleep(500);
      }
    }

    fail(
      `Smoke do standalone falhou em http://127.0.0.1:${port}/api/health: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    );
  } finally {
    await stopChildProcess(child);
  }
}

const shouldRunSmoke = process.argv.includes('--smoke');
const canonicalEntryAbsolutePath = validateCanonicalLayout();

if (shouldRunSmoke) {
  await runSmokeTest(canonicalEntryAbsolutePath);
}
