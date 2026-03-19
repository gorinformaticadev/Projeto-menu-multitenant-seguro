export type AuthSyncEventType =
  | "logout"
  | "refresh-start"
  | "refresh-success"
  | "refresh-failed";

export type AuthSyncEvent = {
  type: AuthSyncEventType;
  sourceTabId: string;
  issuedAt: number;
};

type RefreshLockState = {
  ownerTabId: string;
  token: string;
  expiresAt: number;
};

export const AUTH_SYNC_EVENT_NAME = "auth:sync";
export const AUTH_SYNC_STORAGE_KEY = "__auth_sync_event__";
export const AUTH_REFRESH_LOCK_STORAGE_KEY = "__auth_refresh_lock__";
const AUTH_REFRESH_LOCK_TTL_MS = 15_000;

let tabIdCache: string | null = null;

const hasWindow = () => typeof window !== "undefined";

const generateTabId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const getAuthSyncTabId = () => {
  if (tabIdCache) {
    return tabIdCache;
  }

  tabIdCache = generateTabId();
  return tabIdCache;
};

const parseAuthSyncEvent = (rawValue: string | null): AuthSyncEvent | null => {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<AuthSyncEvent>;
    if (
      !parsed ||
      typeof parsed.type !== "string" ||
      typeof parsed.sourceTabId !== "string" ||
      typeof parsed.issuedAt !== "number"
    ) {
      return null;
    }

    return {
      type: parsed.type as AuthSyncEventType,
      sourceTabId: parsed.sourceTabId,
      issuedAt: parsed.issuedAt,
    };
  } catch {
    return null;
  }
};

const parseRefreshLockState = (rawValue: string | null): RefreshLockState | null => {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<RefreshLockState>;
    if (
      !parsed ||
      typeof parsed.ownerTabId !== "string" ||
      typeof parsed.token !== "string" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }

    return {
      ownerTabId: parsed.ownerTabId,
      token: parsed.token,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
};

const dispatchAuthSyncEvent = (payload: AuthSyncEvent) => {
  if (!hasWindow()) {
    return;
  }

  window.dispatchEvent(new CustomEvent<AuthSyncEvent>(AUTH_SYNC_EVENT_NAME, { detail: payload }));
};

export const publishAuthSyncEvent = (type: AuthSyncEventType) => {
  if (!hasWindow()) {
    return;
  }

  const payload: AuthSyncEvent = {
    type,
    sourceTabId: getAuthSyncTabId(),
    issuedAt: Date.now(),
  };

  dispatchAuthSyncEvent(payload);

  try {
    window.localStorage.setItem(AUTH_SYNC_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignora indisponibilidade de storage sem quebrar autenticacao.
  }
};

export const subscribeToAuthSyncEvents = (
  listener: (event: AuthSyncEvent) => void,
): (() => void) => {
  if (!hasWindow()) {
    return () => undefined;
  }

  const handleCustomEvent = (event: Event) => {
    const detail = (event as CustomEvent<AuthSyncEvent>).detail;
    if (detail) {
      listener(detail);
    }
  };

  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key !== AUTH_SYNC_STORAGE_KEY) {
      return;
    }

    const payload = parseAuthSyncEvent(event.newValue);
    if (payload) {
      listener(payload);
    }
  };

  window.addEventListener(AUTH_SYNC_EVENT_NAME, handleCustomEvent as EventListener);
  window.addEventListener("storage", handleStorageEvent);

  return () => {
    window.removeEventListener(AUTH_SYNC_EVENT_NAME, handleCustomEvent as EventListener);
    window.removeEventListener("storage", handleStorageEvent);
  };
};

export const waitForAuthSyncEvent = (
  predicate: (event: AuthSyncEvent) => boolean,
  timeoutMs = AUTH_REFRESH_LOCK_TTL_MS,
): Promise<AuthSyncEvent | null> =>
  new Promise((resolve) => {
    if (!hasWindow()) {
      resolve(null);
      return;
    }

    let settled = false;
    let timeoutId = 0;
    let unsubscribe = () => undefined;

    const finish = (value: AuthSyncEvent | null) => {
      if (settled) {
        return;
      }

      settled = true;
      unsubscribe();
      window.clearTimeout(timeoutId);
      resolve(value);
    };

    unsubscribe = subscribeToAuthSyncEvents((event) => {
      if (predicate(event)) {
        finish(event);
      }
    });

    timeoutId = window.setTimeout(() => finish(null), timeoutMs);
  });

const readRefreshLock = (): RefreshLockState | null => {
  if (!hasWindow()) {
    return null;
  }

  try {
    return parseRefreshLockState(window.localStorage.getItem(AUTH_REFRESH_LOCK_STORAGE_KEY));
  } catch {
    return null;
  }
};

export const hasPeerRefreshLock = (): boolean => {
  const lockState = readRefreshLock();
  if (!lockState) {
    return false;
  }

  if (lockState.expiresAt <= Date.now()) {
    return false;
  }

  return lockState.ownerTabId !== getAuthSyncTabId();
};

export const tryAcquireAuthRefreshLock = (): boolean => {
  if (!hasWindow()) {
    return true;
  }

  const now = Date.now();
  const currentLock = readRefreshLock();
  if (currentLock && currentLock.expiresAt > now && currentLock.ownerTabId !== getAuthSyncTabId()) {
    return false;
  }

  const nextLock: RefreshLockState = {
    ownerTabId: getAuthSyncTabId(),
    token: `${getAuthSyncTabId()}-${now}-${Math.random().toString(16).slice(2)}`,
    expiresAt: now + AUTH_REFRESH_LOCK_TTL_MS,
  };

  try {
    window.localStorage.setItem(AUTH_REFRESH_LOCK_STORAGE_KEY, JSON.stringify(nextLock));
  } catch {
    return true;
  }

  const confirmedLock = readRefreshLock();
  return confirmedLock?.token === nextLock.token;
};

export const releaseAuthRefreshLock = () => {
  if (!hasWindow()) {
    return;
  }

  const currentLock = readRefreshLock();
  if (!currentLock || currentLock.ownerTabId !== getAuthSyncTabId()) {
    return;
  }

  try {
    window.localStorage.removeItem(AUTH_REFRESH_LOCK_STORAGE_KEY);
  } catch {
    // Ignora indisponibilidade de storage sem quebrar autenticacao.
  }
};
