import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA } from '@nestjs/common/constants';
import {
  BackupsController,
  BackupInternalController,
  BackupLegacyController,
} from '../backup/backup.controller';
import { CRITICAL_RATE_LIMIT_KEY } from '../common/decorators/critical-rate-limit.decorator';
import { SystemUpdateController } from '../update/system-update.controller';
import { UpdateController } from '../update/update.controller';

const THROTTLER_LIMIT_METADATA_KEY = 'THROTTLER:LIMIT';
const THROTTLER_TTL_METADATA_KEY = 'THROTTLER:TTL';

type ControllerClass = new (...args: any[]) => Record<string, any>;

type RouteDescriptor = {
  controllerName: string;
  methodName: string;
  requestMethod: RequestMethod;
  handler: (...args: any[]) => unknown;
};

const CRITICAL_MUTATING_ROUTES = new Map<string, 'backup' | 'restore' | 'update'>([
  ['BackupsController.createBackupJob', 'backup'],
  ['BackupsController.restoreExistingBackup', 'restore'],
  ['BackupsController.restoreFromUpload', 'restore'],
  ['BackupLegacyController.create', 'backup'],
  ['BackupLegacyController.restore', 'restore'],
  ['BackupInternalController.restoreByFile', 'restore'],
  ['UpdateController.executeUpdate', 'update'],
  ['SystemUpdateController.run', 'update'],
  ['SystemUpdateController.rollback', 'update'],
]);

const ALLOWED_NON_CRITICAL_MUTATING_ROUTES = new Set<string>([
  'BackupsController.uploadBackup',
  'BackupsController.cancelJob',
  'BackupLegacyController.upload',
  'BackupLegacyController.deleteBackup',
  'UpdateController.updateConfig',
]);

const MUTATING_METHODS = new Set<RequestMethod>([
  RequestMethod.POST,
  RequestMethod.PUT,
  RequestMethod.PATCH,
  RequestMethod.DELETE,
]);

const TARGET_CONTROLLERS: ControllerClass[] = [
  BackupsController,
  BackupLegacyController,
  BackupInternalController,
  UpdateController,
  SystemUpdateController,
];

function collectControllerRoutes(controllerClass: ControllerClass): RouteDescriptor[] {
  const prototype = controllerClass.prototype;
  return Object.getOwnPropertyNames(prototype)
    .filter((methodName) => methodName !== 'constructor')
    .map((methodName) => {
      const handler = prototype[methodName] as (...args: any[]) => unknown;
      const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler) as
        | RequestMethod
        | undefined;

      if (requestMethod === undefined) {
        return null;
      }

      return {
        controllerName: controllerClass.name,
        methodName,
        requestMethod,
        handler,
      };
    })
    .filter((route): route is RouteDescriptor => route !== null);
}

describe('Critical endpoints regression guard', () => {
  it('fails when a mutating critical-controller route is added without explicit classification', () => {
    const unclassifiedMutatingRoutes: string[] = [];

    for (const controllerClass of TARGET_CONTROLLERS) {
      const routes = collectControllerRoutes(controllerClass);

      for (const route of routes) {
        if (!MUTATING_METHODS.has(route.requestMethod)) {
          continue;
        }

        const routeKey = `${route.controllerName}.${route.methodName}`;
        const isCritical = CRITICAL_MUTATING_ROUTES.has(routeKey);
        const isAllowedNonCritical = ALLOWED_NON_CRITICAL_MUTATING_ROUTES.has(routeKey);

        if (!isCritical && !isAllowedNonCritical) {
          unclassifiedMutatingRoutes.push(routeKey);
        }
      }
    }

    expect(unclassifiedMutatingRoutes).toEqual([]);
  });

  it('keeps all classified critical routes behind dynamic CriticalRateLimit metadata', () => {
    for (const [routeKey, expectedAction] of CRITICAL_MUTATING_ROUTES.entries()) {
      const [controllerName, methodName] = routeKey.split('.');
      const controllerClass = TARGET_CONTROLLERS.find((item) => item.name === controllerName);

      expect(controllerClass).toBeDefined();
      const handler = (controllerClass as ControllerClass).prototype[
        methodName
      ] as (...args: any[]) => unknown;

      expect(handler).toBeDefined();
      expect(Reflect.getMetadata(CRITICAL_RATE_LIMIT_KEY, handler)).toBe(expectedAction);
      expect(Reflect.getMetadata(THROTTLER_LIMIT_METADATA_KEY, handler)).toBeUndefined();
      expect(Reflect.getMetadata(THROTTLER_TTL_METADATA_KEY, handler)).toBeUndefined();
    }
  });
});
