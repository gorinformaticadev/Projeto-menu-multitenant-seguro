import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';

export function formatVersionTag(version: string): string {
  const clean = semver.clean(version);
  return clean ? `v${clean}` : version;
}

export function resolveAppVersionTag(options?: { cwd?: string; env?: NodeJS.ProcessEnv }): string {
  const cwd = options?.cwd || process.cwd();
  const env = options?.env || process.env;

  const envVersion = semver.clean(env.APP_VERSION || env.npm_package_version || '');
  if (envVersion) {
    return formatVersionTag(envVersion);
  }

  const candidates = [
    path.resolve(cwd, 'package.json'),
    path.resolve(cwd, 'apps', 'backend', 'package.json'),
    path.resolve(__dirname, '..', '..', '..', 'package.json'),
  ];

  for (const packagePath of candidates) {
    try {
      if (!fs.existsSync(packagePath)) {
        continue;
      }

      const raw = fs.readFileSync(packagePath, 'utf8');
      const parsed = JSON.parse(raw);
      const clean = semver.clean(parsed?.version || '');
      if (clean) {
        return formatVersionTag(clean);
      }
    } catch (_error) {
      // Ignore and try next candidate path.
    }
  }

  return 'v0.0.0';
}
