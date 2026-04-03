import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';

export type VersionSource =
  | 'git_exact_tag'
  | 'git_describe'
  | 'git_base_tag'
  | 'env'
  | 'file'
  | 'build_info'
  | 'package_json'
  | 'unknown';

interface BuildInfoPayload {
  version?: unknown;
  commitSha?: unknown;
  buildDate?: unknown;
  branch?: unknown;
}

interface PackageJsonPayload {
  version?: unknown;
}

interface VersionShapeInput {
  rawVersion: string;
  source: VersionSource;
  commitSha?: string;
  buildDate?: string;
  branch?: string;
  baseTag?: string | null;
  isExactTaggedRelease?: boolean;
}

export interface ResolvedSystemVersion {
  version: string;
  source: VersionSource;
  versionSource: VersionSource;
  installedVersionRaw: string;
  installedBaseTag: string | null;
  installedVersionNormalized: string | null;
  isExactTaggedRelease: boolean;
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
    asNonEmptyString(env.APP_BASE_DIR),
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
      // Ignora e tenta o proximo candidato.
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
  const packageFile = findFile('package.json', cwd, env);
  if (!packageFile) {
    return undefined;
  }

  try {
    const content = fs.readFileSync(packageFile, 'utf8');
    const parsed = JSON.parse(content) as PackageJsonPayload;
    return asNonEmptyString(parsed.version);
  } catch {
    return undefined;
  }
}

function ensureVersionTagPrefix(version: string): string {
  const trimmed = asNonEmptyString(version) || 'unknown';
  if (trimmed === 'unknown') {
    return trimmed;
  }

  return trimmed.startsWith('v') ? trimmed : `v${trimmed}`;
}

function normalizeDisplayedRawVersion(version: string): string {
  const trimmed = asNonEmptyString(version) || 'unknown';
  if (trimmed === 'unknown') {
    return trimmed;
  }

  return normalizeSemverVersion(trimmed)
    ? ensureVersionTagPrefix(trimmed)
    : trimmed;
}

function normalizeSemverVersion(version: string | undefined): string | null {
  const raw = asNonEmptyString(version);
  if (!raw) {
    return null;
  }

  const valid = semver.valid(raw) || semver.clean(raw) || semver.coerce(raw)?.version;
  if (!valid) {
    return null;
  }

  return semver.parse(valid)?.version || valid;
}

function extractCommitShaFromVersion(rawVersion: string | undefined): string | undefined {
  const raw = asNonEmptyString(rawVersion);
  if (!raw) {
    return undefined;
  }

  const plusIndex = raw.indexOf('+');
  if (plusIndex < 0) {
    return undefined;
  }

  const suffix = raw.slice(plusIndex + 1).trim();
  if (!suffix) {
    return undefined;
  }

  const candidate = suffix.split('.')[0]?.trim();
  if (!candidate || !/^[0-9a-f]{7,40}$/i.test(candidate)) {
    return undefined;
  }

  return candidate;
}

function buildResolvedVersion(input: VersionShapeInput): ResolvedSystemVersion {
  const rawVersion = asNonEmptyString(input.rawVersion) || 'unknown';
  const normalizedBase = normalizeSemverVersion(input.baseTag || rawVersion);
  const installedBaseTag = normalizedBase ? ensureVersionTagPrefix(normalizedBase) : null;
  const commitSha =
    asMeaningfulMetadata(input.commitSha) ||
    extractCommitShaFromVersion(rawVersion);

  return {
    version: rawVersion,
    source: input.source,
    versionSource: input.source,
    installedVersionRaw: rawVersion,
    installedBaseTag,
    installedVersionNormalized: normalizedBase,
    isExactTaggedRelease: Boolean(input.isExactTaggedRelease && installedBaseTag),
    commitSha,
    buildDate: asMeaningfulMetadata(input.buildDate),
    branch: asMeaningfulMetadata(input.branch),
  };
}

function readGitOutput(repoRoot: string, args: string[]): string | undefined {
  try {
    const output = childProcess.execFileSync('git', ['-C', repoRoot, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return asNonEmptyString(output);
  } catch {
    return undefined;
  }
}

function resolveGitRepoRoot(cwd: string, env: NodeJS.ProcessEnv): string | undefined {
  for (const candidate of getRootCandidates(cwd, env)) {
    const repoRoot = readGitOutput(candidate, ['rev-parse', '--show-toplevel']);
    if (repoRoot) {
      return path.resolve(repoRoot);
    }
  }

  return undefined;
}

function toCanonicalTag(tag: string | undefined): string | undefined {
  const normalized = normalizeSemverVersion(tag);
  return normalized ? ensureVersionTagPrefix(normalized) : undefined;
}

function selectHighestSemverTag(tags: string[]): string | undefined {
  const normalizedTags = tags
    .map(tag => toCanonicalTag(tag))
    .filter((tag): tag is string => Boolean(tag));

  if (normalizedTags.length === 0) {
    return undefined;
  }

  return normalizedTags.sort((left, right) => {
    const leftNormalized = normalizeSemverVersion(left) || '0.0.0';
    const rightNormalized = normalizeSemverVersion(right) || '0.0.0';
    return semver.rcompare(leftNormalized, rightNormalized);
  })[0];
}

function resolveExactTaggedVersion(repoRoot: string): string | undefined {
  const raw = readGitOutput(repoRoot, ['tag', '--points-at', 'HEAD']);
  if (!raw) {
    return undefined;
  }

  const tags = raw
    .split(/\r?\n/)
    .map(tag => tag.trim())
    .filter(Boolean);

  return selectHighestSemverTag(tags);
}

function resolveBaseTaggedVersion(repoRoot: string): string | undefined {
  const describeCandidates: string[][] = [
    ['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*'],
    ['describe', '--tags', '--abbrev=0', '--match', '[0-9]*'],
    ['describe', '--tags', '--abbrev=0'],
  ];

  for (const args of describeCandidates) {
    const raw = readGitOutput(repoRoot, args);
    const tag = toCanonicalTag(raw);
    if (tag) {
      return tag;
    }
  }

  return undefined;
}

function resolveGitVersion(cwd: string, env: NodeJS.ProcessEnv, buildInfo: BuildInfoPayload): ResolvedSystemVersion | undefined {
  const repoRoot = resolveGitRepoRoot(cwd, env);
  if (!repoRoot) {
    return undefined;
  }

  const commitSha =
    readGitOutput(repoRoot, ['rev-parse', '--short', 'HEAD']) ||
    asMeaningfulMetadata(env.GIT_SHA) ||
    asMeaningfulMetadata(buildInfo.commitSha);
  const buildDate =
    asMeaningfulMetadata(env.BUILD_TIME) ||
    asMeaningfulMetadata(buildInfo.buildDate);
  const branch =
    asMeaningfulMetadata(env.BUILD_BRANCH) ||
    asMeaningfulMetadata(env.GIT_BRANCH) ||
    asMeaningfulMetadata(buildInfo.branch);

  const exactTag = resolveExactTaggedVersion(repoRoot);
  if (exactTag) {
    return buildResolvedVersion({
      rawVersion: exactTag,
      source: 'git_exact_tag',
      commitSha,
      buildDate,
      branch,
      baseTag: exactTag,
      isExactTaggedRelease: true,
    });
  }

  const baseTag = resolveBaseTaggedVersion(repoRoot);
  if (baseTag && commitSha) {
    return buildResolvedVersion({
      rawVersion: `${baseTag}+${commitSha}`,
      source: 'git_describe',
      commitSha,
      buildDate,
      branch,
      baseTag,
      isExactTaggedRelease: false,
    });
  }

  if (baseTag) {
    return buildResolvedVersion({
      rawVersion: baseTag,
      source: 'git_base_tag',
      commitSha,
      buildDate,
      branch,
      baseTag,
      isExactTaggedRelease: false,
    });
  }

  return undefined;
}

function resolveMetadataVersion(
  rawVersion: string | undefined,
  source: Extract<VersionSource, 'env' | 'file' | 'build_info' | 'package_json'>,
  env: NodeJS.ProcessEnv,
  buildInfo: BuildInfoPayload,
): ResolvedSystemVersion | undefined {
  const normalizedRaw = asNonEmptyString(rawVersion);
  if (!normalizedRaw) {
    return undefined;
  }

  return buildResolvedVersion({
    rawVersion: normalizeDisplayedRawVersion(normalizedRaw),
    source,
    commitSha:
      asMeaningfulMetadata(env.GIT_SHA) ||
      asMeaningfulMetadata(buildInfo.commitSha) ||
      extractCommitShaFromVersion(normalizedRaw),
    buildDate:
      asMeaningfulMetadata(env.BUILD_TIME) ||
      asMeaningfulMetadata(buildInfo.buildDate),
    branch:
      asMeaningfulMetadata(env.BUILD_BRANCH) ||
      asMeaningfulMetadata(env.GIT_BRANCH) ||
      asMeaningfulMetadata(buildInfo.branch),
    isExactTaggedRelease: false,
  });
}

export function formatVersionTag(version: string): string {
  return asNonEmptyString(version) || 'unknown';
}

export function resolveSystemVersion(options?: { cwd?: string; env?: NodeJS.ProcessEnv }): ResolvedSystemVersion {
  const cwd = options?.cwd || process.cwd();
  const env = options?.env || process.env;
  const buildInfo = readBuildInfo(cwd, env);

  const gitVersion = resolveGitVersion(cwd, env, buildInfo);
  if (gitVersion) {
    return gitVersion;
  }

  const envVersion = resolveMetadataVersion(asNonEmptyString(env.APP_VERSION), 'env', env, buildInfo);
  if (envVersion) {
    return envVersion;
  }

  const fileVersion = resolveMetadataVersion(readVersionFromFile(cwd, env), 'file', env, buildInfo);
  if (fileVersion) {
    return fileVersion;
  }

  const buildInfoVersion = resolveMetadataVersion(asNonEmptyString(buildInfo.version), 'build_info', env, buildInfo);
  if (buildInfoVersion) {
    return buildInfoVersion;
  }

  const packageVersion = resolveMetadataVersion(readPackageJsonVersion(cwd, env), 'package_json', env, buildInfo);
  if (packageVersion) {
    return packageVersion;
  }

  return buildResolvedVersion({
    rawVersion: 'unknown',
    source: 'unknown',
    commitSha:
      asMeaningfulMetadata(env.GIT_SHA) ||
      asMeaningfulMetadata(buildInfo.commitSha),
    buildDate:
      asMeaningfulMetadata(env.BUILD_TIME) ||
      asMeaningfulMetadata(buildInfo.buildDate),
    branch:
      asMeaningfulMetadata(env.BUILD_BRANCH) ||
      asMeaningfulMetadata(env.GIT_BRANCH) ||
      asMeaningfulMetadata(buildInfo.branch),
    isExactTaggedRelease: false,
  });
}

export function resolveAppVersionTag(options?: { cwd?: string; env?: NodeJS.ProcessEnv }): string {
  return resolveSystemVersion(options).version;
}
