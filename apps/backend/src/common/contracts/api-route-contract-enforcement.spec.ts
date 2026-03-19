import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveApiRouteContractPolicy } from '@contracts/api-routes';

const BACKEND_SRC_DIR = path.resolve(__dirname, '../..');
const INCLUDED_CONTROLLER_FILES = [
  'auth/auth.controller.ts',
  'dashboard/system-dashboard.controller.ts',
  'users/users.controller.ts',
  'tenants/tenants.controller.ts',
  'diagnostics/system-diagnostics.controller.ts',
  'maintenance/maintenance.controller.ts',
  'health/health.controller.ts',
  'retention/system-data-retention.controller.ts',
  'security-config/security-config.controller.ts',
  'audit/audit.controller.ts',
  'security-config/platform-config.controller.ts',
  'security-config/email-config.controller.ts',
  'notifications/system-notifications.controller.ts',
  'update/system-update.controller.ts',
  'update/update.controller.ts',
  'audit/system-audit.controller.ts',
  'backup/backup.controller.ts',
  'notifications/notifications.controller.ts',
  'common/controllers/system-version.controller.ts',
  'common/controllers/health.controller.ts',
  'common/controllers/csp-report.controller.ts',
  'core/module-installer.controller.ts',
  'core/cron/cron.controller.ts',
] as const;

describe('backend api route contract enforcement', () => {
  it('keeps every active controller route behind a shared route policy', () => {
    const violations = INCLUDED_CONTROLLER_FILES.flatMap((relativeFilePath) => {
      const filePath = path.join(BACKEND_SRC_DIR, relativeFilePath);
      const source = fs.readFileSync(filePath, 'utf8');
      const routes = extractControllerRoutes(source);

      return routes
        .filter((routePath) => resolveApiRouteContractPolicy(routePath).id === 'default')
        .map((routePath) => `${relativeFilePath} -> ${routePath}`);
    });

    expect(violations).toEqual([]);
  });

  it('forces controllers with multi-version contracts to use req.apiVersion explicitly', () => {
    const violations = INCLUDED_CONTROLLER_FILES.flatMap((relativeFilePath) => {
      const filePath = path.join(BACKEND_SRC_DIR, relativeFilePath);
      const source = fs.readFileSync(filePath, 'utf8');
      const routes = extractControllerRoutes(source);
      const requiresVersionAwareness = routes.some(
        (routePath) => resolveApiRouteContractPolicy(routePath).supportedVersions.length > 1,
      );

      if (!requiresVersionAwareness) {
        return [];
      }

      return source.includes('apiVersion') || source.includes('getApiVersion(')
        ? []
        : [relativeFilePath];
    });

    expect(violations).toEqual([]);
  });
});

function extractControllerRoutes(source: string): string[] {
  const routes = new Set<string>();

  for (const section of source.split(/(?=@Controller\()/g)) {
    if (!section.includes('@Controller(')) {
      continue;
    }

    const controllerMatch = section.match(/@Controller\((?:'([^']*)'|"([^"]*)")?\)/);
    const controllerBase = normalizeRoutePath(controllerMatch?.[1] || controllerMatch?.[2] || '');
    const routeDecorator = /@(Get|Post|Put|Patch|Delete|Options)\((?:'([^']*)'|"([^"]*)")?\)/g;

    for (const match of section.matchAll(routeDecorator)) {
      const methodPath = normalizeRoutePath(match[2] || match[3] || '');
      routes.add(joinRouteSegments(controllerBase, methodPath));
    }
  }

  return [...routes];
}

function normalizeRoutePath(value: string): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '/';
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function joinRouteSegments(basePath: string, methodPath: string): string {
  if (basePath === '/' && methodPath === '/') {
    return '/';
  }

  if (basePath === '/') {
    return methodPath;
  }

  if (methodPath === '/') {
    return basePath;
  }

  return `${basePath}/${methodPath.replace(/^\//, '')}`;
}
