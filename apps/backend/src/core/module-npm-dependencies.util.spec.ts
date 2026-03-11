import { BadRequestException } from '@nestjs/common';
import {
  areDependencyRangesCompatible,
  classifyModuleNpmDependencies,
  mergeDependenciesIntoPackageJson,
  normalizeModuleNpmDependencies,
} from './module-npm-dependencies.util';

describe('module-npm-dependencies.util', () => {
  it('returns empty array when npmDependencies is null', () => {
    expect(normalizeModuleNpmDependencies(null)).toEqual([]);
  });

  it('normalizes valid backend and frontend dependencies', () => {
    const result = normalizeModuleNpmDependencies({
      backend: {
        axios: '^1.7.2',
      },
      frontend: {
        '@tanstack/react-query': '^5.59.0',
      },
    });

    expect(result).toEqual([
      { target: 'backend', packageName: 'axios', version: '^1.7.2' },
      {
        target: 'frontend',
        packageName: '@tanstack/react-query',
        version: '^5.59.0',
      },
    ]);
  });

  it.each([
    'latest',
    '*',
    'github:user/repo',
    'git://repo',
    'git+https://repo',
    'file:../lib',
    'link:../lib',
    'workspace:*',
    'http://example.com/package.tgz',
    'https://example.com/package.tgz',
  ])('blocks unsafe npm version "%s"', (unsafeVersion) => {
    expect(() =>
      normalizeModuleNpmDependencies({
        backend: {
          axios: unsafeVersion,
        },
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      normalizeModuleNpmDependencies({
        backend: {
          axios: unsafeVersion,
        },
      }),
    ).toThrow(/MODULE_DEPENDENCY_VALIDATION_FAILED/);
  });

  it('detects compatibility and conflicts against current package.json', () => {
    const normalized = normalizeModuleNpmDependencies({
      backend: {
        zod: '^4.0.0',
        axios: '^1.7.2',
      },
      frontend: {
        react: '^18.2.0',
      },
    });

    const classified = classifyModuleNpmDependencies(normalized, {
      backend: {
        dependencies: {
          zod: '^3.23.8',
          axios: '^1.7.0',
        },
      },
      frontend: {
        dependencies: {
          react: '^18.2.0',
        },
      },
    });

    expect(classified).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: 'backend',
          packageName: 'zod',
          action: 'conflict',
        }),
        expect.objectContaining({
          target: 'backend',
          packageName: 'axios',
          action: 'compatible',
        }),
        expect.objectContaining({
          target: 'frontend',
          packageName: 'react',
          action: 'compatible',
        }),
      ]),
    );
  });

  it('merges dependencies into package.json in alphabetical order', () => {
    const merged = mergeDependenciesIntoPackageJson(
      {
        name: 'backend',
        dependencies: {
          zod: '^3.23.8',
        },
      },
      [
        { packageName: 'axios', version: '^1.7.2' },
        { packageName: 'nestjs', version: '11.1.0' },
      ],
    );

    expect(merged.dependencies).toEqual({
      axios: '^1.7.2',
      nestjs: '11.1.0',
      zod: '^3.23.8',
    });
  });

  it('checks semver range compatibility correctly', () => {
    expect(areDependencyRangesCompatible('^1.7.0', '^1.7.2')).toBe(true);
    expect(areDependencyRangesCompatible('^3.23.0', '^4.0.0')).toBe(false);
  });
});
