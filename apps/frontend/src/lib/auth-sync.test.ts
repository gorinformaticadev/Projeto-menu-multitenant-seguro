import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_REFRESH_LOCK_STORAGE_KEY,
  AUTH_SYNC_STORAGE_KEY,
  getAuthSyncTabId,
  hasPeerRefreshLock,
  publishAuthSyncEvent,
  releaseAuthRefreshLock,
  subscribeToAuthSyncEvents,
  tryAcquireAuthRefreshLock,
  waitForAuthSyncEvent,
} from "@/lib/auth-sync";

describe("auth-sync", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    releaseAuthRefreshLock();
    window.localStorage.clear();
  });

  it("publishes auth sync events locally with the current tab id", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToAuthSyncEvents(listener);

    publishAuthSyncEvent("refresh-success");

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "refresh-success",
        sourceTabId: getAuthSyncTabId(),
        issuedAt: expect.any(Number),
      }),
    );
    expect(window.localStorage.getItem(AUTH_SYNC_STORAGE_KEY)).toContain("refresh-success");

    unsubscribe();
  });

  it("waits for auth sync events that satisfy a predicate", async () => {
    const pending = waitForAuthSyncEvent((event) => event.type === "logout");

    publishAuthSyncEvent("refresh-start");
    publishAuthSyncEvent("logout");

    await expect(pending).resolves.toEqual(
      expect.objectContaining({
        type: "logout",
      }),
    );
  });

  it("treats a foreign refresh lock as an active peer refresh", () => {
    window.localStorage.setItem(
      AUTH_REFRESH_LOCK_STORAGE_KEY,
      JSON.stringify({
        ownerTabId: "peer-tab",
        token: "peer-token",
        expiresAt: Date.now() + 10_000,
      }),
    );

    expect(hasPeerRefreshLock()).toBe(true);
    expect(tryAcquireAuthRefreshLock()).toBe(false);
  });

  it("acquires and releases the refresh lock for the current tab", () => {
    expect(tryAcquireAuthRefreshLock()).toBe(true);
    expect(hasPeerRefreshLock()).toBe(false);
    expect(window.localStorage.getItem(AUTH_REFRESH_LOCK_STORAGE_KEY)).toContain(
      getAuthSyncTabId(),
    );

    releaseAuthRefreshLock();

    expect(window.localStorage.getItem(AUTH_REFRESH_LOCK_STORAGE_KEY)).toBeNull();
  });
});
