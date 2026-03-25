import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(scriptDir, '..');

const standaloneLayouts = [
  {
    label: 'monorepo-nested',
    entryRelativePath: path.join('.next', 'standalone', 'apps', 'frontend', 'server.js'),
    runtimeDirRelativePath: path.join('.next', 'standalone', 'apps', 'frontend'),
    buildDirRelativePath: path.join('.next', 'standalone', 'apps', 'frontend', '.next'),
  },
  {
    label: 'root',
    entryRelativePath: path.join('.next', 'standalone', 'server.js'),
    runtimeDirRelativePath: path.join('.next', 'standalone'),
    buildDirRelativePath: path.join('.next', 'standalone', '.next'),
  },
];

function toAbsolutePath(relativePath) {
  return path.resolve(frontendDir, relativePath);
}

function toPortablePath(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function resolveStandaloneLayout() {
  const detected = standaloneLayouts.find((layout) => existsSync(toAbsolutePath(layout.entryRelativePath)));
  if (!detected) {
    const checkedPaths = standaloneLayouts.map((layout) => toAbsolutePath(layout.entryRelativePath)).join(' | ');
    throw new Error(`Nenhum entrypoint standalone do frontend foi encontrado. Caminhos verificados: ${checkedPaths}`);
  }

  return {
    ...detected,
    entryAbsolutePath: toAbsolutePath(detected.entryRelativePath),
    runtimeDirAbsolutePath: toAbsolutePath(detected.runtimeDirRelativePath),
    buildDirAbsolutePath: toAbsolutePath(detected.buildDirRelativePath),
  };
}

function printResolvedValue(command, resolved) {
  switch (command) {
    case '--print-layout':
      console.log(
        [
          resolved.label,
          toPortablePath(resolved.entryRelativePath),
          toPortablePath(resolved.runtimeDirRelativePath),
          toPortablePath(resolved.buildDirRelativePath),
        ].join('|'),
      );
      return true;
    case '--print-entry':
      console.log(resolved.entryAbsolutePath);
      return true;
    case '--print-entry-relative':
      console.log(toPortablePath(resolved.entryRelativePath));
      return true;
    case '--print-runtime-dir':
      console.log(resolved.runtimeDirAbsolutePath);
      return true;
    case '--print-runtime-dir-relative':
      console.log(toPortablePath(resolved.runtimeDirRelativePath));
      return true;
    case '--print-build-dir':
      console.log(resolved.buildDirAbsolutePath);
      return true;
    case '--print-build-dir-relative':
      console.log(toPortablePath(resolved.buildDirRelativePath));
      return true;
    case '--validate-only':
      console.log(`Layout standalone detectado: ${resolved.label} (${toPortablePath(resolved.entryRelativePath)})`);
      return true;
    default:
      return false;
  }
}

function startStandaloneServer(resolved, forwardedArgs) {
  const child = spawn(process.execPath, [resolved.entryAbsolutePath, ...forwardedArgs], {
    cwd: frontendDir,
    env: process.env,
    stdio: 'inherit',
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });

  child.on('error', (error) => {
    console.error(`Falha ao iniciar o standalone do frontend: ${error.message}`);
    process.exit(1);
  });
}

try {
  const command = process.argv[2];
  const resolved = resolveStandaloneLayout();

  if (command && printResolvedValue(command, resolved)) {
    process.exit(0);
  }

  startStandaloneServer(resolved, process.argv.slice(2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
