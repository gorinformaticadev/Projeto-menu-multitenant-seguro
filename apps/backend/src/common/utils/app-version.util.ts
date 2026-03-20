import * as fs from 'fs';
import * as path from 'path';

export type VersionSource = 'env' | 'file' | 'build_info' | 'unknown';

interface BuildInfoPayload {
  version?: unknown;
  commitSha?: unknown;
  buildDate?: unknown;
  branch?: unknown;
}

interface PackageJsonPayload {
  version?: unknown;
  private?: unknown;
  workspaces?: unknown;
}

export interface ResolvedSystemVersion {
  version: string;
  source: VersionSource;
  commitSha?: string;
  buildDate?: string;
  branch?: string;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function asMeaningfulMetadata(value: unknown): string | undefined {
  const normalized = asNonEmptyString(value);
  if (!normalized) {
    return undefined;
  }

  const lower = normalized.toLowerCase();
  if (lower === 'unknown' || lower === 'n/a' || lower === 'na' || lower === 'null') {
    return undefined;
  }

  return normalized;
}

function detectDockerLikeRuntime(env: NodeJS.ProcessEnv): boolean {
  if (env.IS_DOCKER === 'true') {
    return true;
  }

  try {
    return fs.existsSync('/.dockerenv');
  } catch {
    return false;
  }
}

function getRootCandidates(cwd: string, env: NodeJS.ProcessEnv): string[] {
  const candidates = [
    asNonEmptyString(env.PROJECT_ROOT),
    detectDockerLikeRuntime(env) ? '/app' : undefined,
    cwd,
    path.resolve(cwd, '..'),
    path.resolve(cwd, '..', '..'),
    path.resolve(__dirname, '..', '..', '..'),
    path.resolve(__dirname, '..', '..', '..', '..'),
    path.resolve(__dirname, '..', '..', '..', '..', '..'),
  ];

  const uniqueCandidates = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    uniqueCandidates.add(path.resolve(candidate));
  }

  return Array.from(uniqueCandidates);
}

function findFile(filename: string, cwd: string, env: NodeJS.ProcessEnv): string | undefined {
  const roots = getRootCandidates(cwd, env);

  for (const root of roots) {
    const candidate = path.join(root, filename);
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // Ignore and continue trying the next candidate.
    }
  }

  return undefined;
}

function readVersionFromFile(cwd: string, env: NodeJS.ProcessEnv): string | undefined {
  const versionFile = findFile('VERSION', cwd, env);
  if (!versionFile) {
    return undefined;
  }

  try {
    return asNonEmptyString(fs.readFileSync(versionFile, 'utf8'));
  } catch {
    return undefined;
  }
}

function readBuildInfo(cwd: string, env: NodeJS.ProcessEnv): BuildInfoPayload {
  const buildInfoFile = findFile('BUILD_INFO.json', cwd, env);
  if (!buildInfoFile) {
    return {};
  }

  try {
    const content = fs.readFileSync(buildInfoFile, 'utf8');
    const parsed = JSON.parse(content) as BuildInfoPayload;
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

function readPackageJsonVersion(cwd: string, env: NodeJS.ProcessEnv): string | undefined {
  const roots = getRootCandidates(cwd, env);
  const workspacePackageJsonCandidates: string[] = [];
  const packageJsonCandidates: string[] = [];

  for (const root of roots) {
    const candidate = path.join(root, 'package.json');
    try {
      if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) {
        continue;
      }

      const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8')) as PackageJsonPayload;
      if (!parsed || typeof parsed !== 'object') {
        continue;
      }

      const version = asNonEmptyString(parsed.version);
      if (!version) {
        continue;
      }

      if (parsed.private === true || parsed.workspaces) {
        workspacePackageJsonCandidates.push(version);
      } else {
        packageJsonCandidates.push(version);
      }
    } catch {
      // Ignore malformed package.json files and continue.
    }
  }

  return workspacePackageJsonCandidates[0] || packageJsonCandidates[0];
}

function composeVersion(
  version: string,
  source: VersionSource,
  env: NodeJS.ProcessEnv,
  buildInfo: BuildInfoPayload,
): ResolvedSystemVersion {
  return {
    version: asNonEmptyString(version) || 'unknown',
    source,
    commitSha: asMeaningfulMetadata(env.GIT_SHA) || asMeaningfulMetadata(buildInfo.commitSha),
    buildDate: asMeaningfulMetadata(env.BUILD_TIME) || asMeaningfulMetadata(buildInfo.buildDate),
    branch:
      asMeaningfulMetadata(env.BUILD_BRANCH) ||
      asMeaningfulMetadata(env.GIT_BRANCH) ||
      asMeaningfulMetadata(buildInfo.branch),
  };
}

export function formatVersionTag(version: string): string {
  return asNonEmptyString(version) || 'unknown';
}

export function resolveSystemVersion(options?: { cwd?: string; env?: NodeJS.ProcessEnv }): ResolvedSystemVersion {
  const cwd = options?.cwd || process.cwd();
  const env = options?.env || process.env;
  const buildInfo = readBuildInfo(cwd, env);

  const envVersion = asNonEmptyString(env.APP_VERSION);
  if (envVersion) {
    return composeVersion(envVersion, 'env', env, buildInfo);
  }

  const fileVersion = readVersionFromFile(cwd, env);
  if (fileVersion) {
    return composeVersion(fileVersion, 'file', env, buildInfo);
  }

  const buildInfoVersion = asNonEmptyString(buildInfo.version);
  if (buildInfoVersion) {
    return composeVersion(buildInfoVersion, 'build_info', env, buildInfo);
  }

  const packageJsonVersion = readPackageJsonVersion(cwd, env);
  if (packageJsonVersion) {
    return composeVersion(packageJsonVersion, 'file', env, buildInfo);
  }

  return composeVersion('unknown', 'unknown', env, buildInfo);
}

export function resolveAppVersionTag(options?: { cwd?: string; env?: NodeJS.ProcessEnv }): string {
  return resolveSystemVersion(options).version;
}
