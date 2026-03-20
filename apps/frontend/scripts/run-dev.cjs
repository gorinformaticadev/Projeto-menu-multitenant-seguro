const net = require('node:net');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');

const PORT = Number(process.env.PORT || 5000);
const NEXT_BIN = require.resolve('next/dist/bin/next');
const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(WORKSPACE_ROOT, '..', '..');

function isPortInUse(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', (error) => {
      if (error && error.code === 'EADDRINUSE') {
        resolve(true);
        return;
      }
      reject(error);
    });
    server.listen(port, '0.0.0.0', () => {
      server.close(() => resolve(false));
    });
  });
}

function runPowerShell(command) {
  return execFileSync('powershell.exe', ['-NoProfile', '-Command', command], {
    cwd: WORKSPACE_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function getPortOwner(port) {
  if (process.platform !== 'win32') {
    return null;
  }

  try {
    const pidOutput = runPowerShell(
      `Get-NetTCPConnection -LocalPort ${port} -State Listen | Select-Object -First 1 -ExpandProperty OwningProcess`,
    );
    const pid = Number.parseInt(pidOutput, 10);
    if (!Number.isFinite(pid) || pid <= 0) {
      return null;
    }

    const commandLine = runPowerShell(
      `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}").CommandLine`,
    );

    return {
      pid,
      commandLine,
    };
  } catch {
    return null;
  }
}

function looksLikeStaleProjectNextProcess(owner) {
  if (!owner || !owner.commandLine) {
    return false;
  }

  const normalizedCommandLine = owner.commandLine.toLowerCase();
  const normalizedWorkspaceRoot = WORKSPACE_ROOT.toLowerCase();
  const normalizedRepoRoot = REPO_ROOT.toLowerCase();

  return (
    (normalizedCommandLine.includes(normalizedWorkspaceRoot) ||
      normalizedCommandLine.includes(normalizedRepoRoot)) &&
    normalizedCommandLine.includes('next') &&
    normalizedCommandLine.includes('start-server.js')
  );
}

function killProcess(pid) {
  if (process.platform === 'win32') {
    execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return;
  }

  process.kill(pid, 'SIGTERM');
}

async function waitForPortToFree(port, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const owner = getPortOwner(port);
    if (!owner && !(await isPortInUse(port))) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return !getPortOwner(port) && !(await isPortInUse(port));
}

async function ensurePortAvailable(port) {
  const owner = getPortOwner(port);
  if (!owner && !(await isPortInUse(port))) {
    return;
  }
  if (looksLikeStaleProjectNextProcess(owner)) {
    console.warn(
      `[dev] Porta ${port} ocupada por um processo Next órfão deste workspace (PID ${owner.pid}). Encerrando antes de subir o dev server...`,
    );
    killProcess(owner.pid);

    if (await waitForPortToFree(port)) {
      return;
    }

    throw new Error(
      `A porta ${port} continuou ocupada após encerrar o processo órfão ${owner.pid}.`,
    );
  }

  const detail = owner
    ? `PID ${owner.pid}${owner.commandLine ? ` -> ${owner.commandLine}` : ''}`
    : 'processo não identificado';
  throw new Error(
    `A porta ${port} já está em uso por ${detail}. Libere a porta ou defina PORT para iniciar o frontend.`,
  );
}

async function main() {
  await ensurePortAvailable(PORT);

  const child = spawn(process.execPath, [NEXT_BIN, 'dev', '-p', String(PORT)], {
    cwd: WORKSPACE_ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: String(PORT),
    },
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[dev] ${message}`);
  process.exit(1);
});
