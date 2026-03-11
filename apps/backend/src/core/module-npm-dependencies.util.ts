import { BadRequestException } from '@nestjs/common';
import * as semver from 'semver';

export type ModuleNpmDependencyTarget = 'backend' | 'frontend';
export type ModuleNpmDependencySource = 'dependencies' | 'devDependencies';

export interface ModuleManifestNpmDependencies {
  backend?: Record<string, string> | null;
  frontend?: Record<string, string> | null;
}

export interface NormalizedModuleNpmDependency {
  target: ModuleNpmDependencyTarget;
  packageName: string;
  version: string;
}

export interface PackageJsonLike {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

export interface ClassifiedModuleNpmDependency {
  target: ModuleNpmDependencyTarget;
  packageName: string;
  requestedVersion: string;
  currentVersion?: string;
  source?: ModuleNpmDependencySource;
  action: 'add' | 'compatible' | 'conflict';
}

const FORBIDDEN_EXACT_SPECS = new Set(['latest', '*']);
const FORBIDDEN_PREFIXES = [
  'github:',
  'git:',
  'git+',
  'file:',
  'link:',
  'workspace:',
  'http:',
  'https:',
];
const PACKAGE_NAME_REGEX =
  /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
const SAFE_VERSION_REGEX =
  /^(?:\^|~)?\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;

function validationError(message: string): never {
  throw new BadRequestException(`MODULE_DEPENDENCY_VALIDATION_FAILED: ${message}`);
}

function ensurePlainObject(value: unknown, fieldName: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    validationError(`Campo "${fieldName}" deve ser um objeto com pares pacote:versao.`);
  }
  return value as Record<string, unknown>;
}

function validatePackageName(packageName: string, target: ModuleNpmDependencyTarget): void {
  const normalized = packageName.trim();
  if (!normalized) {
    validationError(`Dependencia NPM vazia em npmDependencies.${target}.`);
  }

  if (normalized !== normalized.toLowerCase()) {
    validationError(
      `Pacote "${packageName}" em npmDependencies.${target} deve estar em minusculas.`,
    );
  }

  if (!PACKAGE_NAME_REGEX.test(normalized)) {
    validationError(
      `Pacote "${packageName}" em npmDependencies.${target} possui formato invalido.`,
    );
  }
}

function validateVersionSpecifier(
  packageName: string,
  version: string,
  target: ModuleNpmDependencyTarget,
): void {
  const normalized = version.trim();
  if (!normalized) {
    validationError(
      `Versao ausente para pacote "${packageName}" em npmDependencies.${target}.`,
    );
  }

  const lower = normalized.toLowerCase();
  if (FORBIDDEN_EXACT_SPECS.has(lower)) {
    validationError(
      `Versao "${version}" do pacote "${packageName}" em npmDependencies.${target} nao e permitida.`,
    );
  }

  if (FORBIDDEN_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
    validationError(
      `Versao "${version}" do pacote "${packageName}" em npmDependencies.${target} usa um protocolo bloqueado.`,
    );
  }

  if (!SAFE_VERSION_REGEX.test(normalized)) {
    validationError(
      `Versao "${version}" do pacote "${packageName}" em npmDependencies.${target} nao segue politica de versao segura.`,
    );
  }

  if (!semver.validRange(normalized)) {
    validationError(
      `Versao "${version}" do pacote "${packageName}" em npmDependencies.${target} nao e um semver valido.`,
    );
  }
}

export function normalizeModuleNpmDependencies(
  npmDependencies: unknown,
): NormalizedModuleNpmDependency[] {
  if (npmDependencies == null) {
    return [];
  }

  const npmDepsObject = ensurePlainObject(npmDependencies, 'npmDependencies');
  const normalizedEntries: NormalizedModuleNpmDependency[] = [];
  const targets: ModuleNpmDependencyTarget[] = ['backend', 'frontend'];

  for (const target of targets) {
    const value = npmDepsObject[target];
    if (value == null) {
      continue;
    }

    const dependenciesObject = ensurePlainObject(value, `npmDependencies.${target}`);
    for (const [packageName, versionValue] of Object.entries(dependenciesObject)) {
      if (typeof versionValue !== 'string') {
        validationError(
          `Versao invalida para pacote "${packageName}" em npmDependencies.${target}; esperado string.`,
        );
      }

      validatePackageName(packageName, target);
      validateVersionSpecifier(packageName, versionValue, target);

      normalizedEntries.push({
        target,
        packageName: packageName.trim(),
        version: versionValue.trim(),
      });
    }
  }

  return normalizedEntries;
}

export function areDependencyRangesCompatible(
  existingVersion: string,
  requestedVersion: string,
): boolean {
  const existing = existingVersion.trim();
  const requested = requestedVersion.trim();
  if (!existing || !requested) return false;
  if (existing === requested) return true;

  const existingRange = semver.validRange(existing);
  const requestedRange = semver.validRange(requested);
  if (!existingRange || !requestedRange) return false;

  return semver.intersects(existingRange, requestedRange, {
    includePrerelease: true,
  });
}

export function classifyModuleNpmDependencies(
  entries: NormalizedModuleNpmDependency[],
  packageJsonByTarget: Record<ModuleNpmDependencyTarget, PackageJsonLike>,
): ClassifiedModuleNpmDependency[] {
  return entries.map((entry) => {
    const packageJson = packageJsonByTarget[entry.target] ?? {};
    const dependencies = packageJson.dependencies ?? {};
    const devDependencies = packageJson.devDependencies ?? {};

    let source: ModuleNpmDependencySource | undefined;
    let currentVersion: string | undefined;

    if (dependencies[entry.packageName]) {
      source = 'dependencies';
      currentVersion = dependencies[entry.packageName];
    } else if (devDependencies[entry.packageName]) {
      source = 'devDependencies';
      currentVersion = devDependencies[entry.packageName];
    }

    if (!currentVersion) {
      return {
        target: entry.target,
        packageName: entry.packageName,
        requestedVersion: entry.version,
        action: 'add',
      };
    }

    if (areDependencyRangesCompatible(currentVersion, entry.version)) {
      return {
        target: entry.target,
        packageName: entry.packageName,
        requestedVersion: entry.version,
        currentVersion,
        source,
        action: 'compatible',
      };
    }

    return {
      target: entry.target,
      packageName: entry.packageName,
      requestedVersion: entry.version,
      currentVersion,
      source,
      action: 'conflict',
    };
  });
}

function sortDependencyMap(dependencies: Record<string, string>): Record<string, string> {
  return Object.keys(dependencies)
    .sort((a, b) => a.localeCompare(b))
    .reduce<Record<string, string>>((acc, packageName) => {
      acc[packageName] = dependencies[packageName];
      return acc;
    }, {});
}

export function mergeDependenciesIntoPackageJson(
  packageJson: PackageJsonLike,
  additions: Array<Pick<NormalizedModuleNpmDependency, 'packageName' | 'version'>>,
): PackageJsonLike {
  const currentDeps = {
    ...(packageJson.dependencies ?? {}),
  };

  for (const addition of additions) {
    currentDeps[addition.packageName] = addition.version;
  }

  return {
    ...packageJson,
    dependencies: sortDependencyMap(currentDeps),
  };
}

export function formatDependencyConflictMessage(
  conflicts: Array<Pick<ClassifiedModuleNpmDependency, 'target' | 'packageName' | 'requestedVersion' | 'currentVersion'>>,
): string {
  if (conflicts.length === 0) return '';

  const details = conflicts.map((item) => {
    const current = item.currentVersion ?? 'nao definido';
    return `${item.target}:${item.packageName} (solicitado ${item.requestedVersion}, existente ${current})`;
  });

  return `MODULE_DEPENDENCY_CONFLICT: ${details.join('; ')}`;
}
