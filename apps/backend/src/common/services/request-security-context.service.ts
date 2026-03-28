import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Request } from 'express';

export interface SecurityActor {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  tenantId?: string | null;
  sessionId?: string | null;
}

type RequestUser = {
  id?: string;
  sub?: string;
  name?: string;
  email?: string;
  role?: string;
  tenantId?: string | null;
  sid?: string;
};

type RequestLike = Request & {
  user?: RequestUser;
};

type SecurityContextStore = {
  request?: RequestLike;
  actor?: SecurityActor | null;
  source?: 'http' | 'ws' | 'system';
  tenantEnforcementBypassed?: boolean;
  bypassReason?: string | null;
};

@Injectable()
export class RequestSecurityContextService {
  private readonly storage = new AsyncLocalStorage<SecurityContextStore>();

  runWithRequest<T>(request: RequestLike, callback: () => T): T {
    return this.storage.run(
      {
        request,
        source: 'http',
      },
      callback,
    );
  }

  runWithActor<T>(actor: SecurityActor, callback: () => T): T {
    const current = this.getStore();
    return this.storage.run(
      {
        ...current,
        actor,
        source: current?.source === 'http' ? 'http' : 'ws',
      },
      callback,
    );
  }

  runWithoutTenantEnforcement<T>(reason: string, callback: () => T): T {
    const current = this.getStore();
    return this.storage.run(
      {
        ...current,
        tenantEnforcementBypassed: true,
        bypassReason: reason,
      },
      callback,
    );
  }

  getRequest<T = RequestLike>(): T | undefined {
    return this.getStore()?.request as T | undefined;
  }

  getActor(): SecurityActor | null {
    const store = this.getStore();
    if (store?.actor) {
      return this.normalizeActor(store.actor);
    }

    const requestUser = store?.request?.user;
    if (!requestUser) {
      return null;
    }

    return this.normalizeActor({
      id: requestUser.id || requestUser.sub || null,
      email: requestUser.email || null,
      role: requestUser.role || null,
      tenantId: requestUser.tenantId ?? null,
      sessionId: requestUser.sid || null,
    });
  }

  getTenantId(): string | null {
    return this.getActor()?.tenantId ?? null;
  }

  isTenantEnforcementBypassed(): boolean {
    return this.getStore()?.tenantEnforcementBypassed === true;
  }

  shouldEnforceTenantScope(): boolean {
    if (this.isTenantEnforcementBypassed()) {
      return false;
    }

    const actor = this.getActor();
    if (!actor) {
      return false;
    }

    return String(actor.role || '').toUpperCase() !== 'SUPER_ADMIN';
  }

  private getStore(): SecurityContextStore | undefined {
    return this.storage.getStore();
  }

  private normalizeActor(actor: SecurityActor): SecurityActor {
    return {
      id: this.normalizeString(actor.id),
      name: this.normalizeString(actor.name),
      email: this.normalizeString(actor.email),
      role: this.normalizeString(actor.role),
      tenantId: this.normalizeString(actor.tenantId),
      sessionId: this.normalizeString(actor.sessionId),
    };
  }

  private normalizeString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }
}
