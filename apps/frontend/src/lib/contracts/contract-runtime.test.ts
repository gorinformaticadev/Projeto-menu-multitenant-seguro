import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import {
  CONTRACT_DEGRADATION_EVENT_NAME,
  ContractValidationError,
  executeContractRequestWithRetry,
  isTransientRequestError,
  parseVersionedContractValue,
} from "@/lib/contracts/contract-runtime";

describe("contract-runtime", () => {
  it("parses a versioned response using the preferred version when available", () => {
    const parsed = parseVersionedContractValue(
      {
        "1": z.object({ id: z.string() }).strict(),
        "2": z.object({ id: z.string(), action: z.string().nullable() }).strict(),
      },
      {
        id: "alert-1",
        action: null,
      },
      "/system/dashboard",
      "response",
      "2",
    );

    expect(parsed).toEqual({
      id: "alert-1",
      action: null,
    });
  });

  it("falls back to a known older version instead of crashing on a compatible legacy body", () => {
    const parsed = parseVersionedContractValue(
      {
        "1": z.object({ id: z.string() }).strict(),
        "2": z.object({ id: z.string(), action: z.string().nullable() }).strict(),
      },
      {
        id: "alert-1",
      },
      "/system/dashboard",
      "response",
      null,
      {
        expectedVersion: "2",
        allowVersionFallback: true,
      },
    );

    expect(parsed).toEqual({
      id: "alert-1",
    });
  });

  it("does not silently downgrade when the backend explicitly says v2 but sends a v1 body", () => {
    expect(() =>
      parseVersionedContractValue(
        {
          "1": z.object({ id: z.string() }).strict(),
          "2": z.object({ id: z.string(), action: z.string().nullable() }).strict(),
        },
        {
          id: "alert-1",
        },
        "/system/dashboard",
        "response",
        "2",
      ),
    ).toThrow(/Contrato invalido de response/i);
  });

  it("emits a visible degradation event when a missing version header forces a controlled downgrade", () => {
    const listener = vi.fn();
    window.addEventListener(CONTRACT_DEGRADATION_EVENT_NAME, listener as EventListener);

    parseVersionedContractValue(
      {
        "1": z.object({ id: z.string() }).strict(),
        "2": z.object({ id: z.string(), action: z.string().nullable() }).strict(),
      },
      {
        id: "alert-1",
      },
      "/system/dashboard",
      "response",
      null,
      {
        expectedVersion: "2",
        allowVersionFallback: true,
      },
    );

    expect(listener).toHaveBeenCalled();
    window.removeEventListener(CONTRACT_DEGRADATION_EVENT_NAME, listener as EventListener);
  });

  it("retries only transient failures and succeeds with exponential backoff", async () => {
    const request = vi
      .fn<() => Promise<{ ok: true }>>()
      .mockRejectedValueOnce(
        Object.assign(new Error("temporarily unavailable"), {
          response: { status: 503 },
        }),
      )
      .mockResolvedValueOnce({ ok: true });

    await expect(
      executeContractRequestWithRetry(request, {
        attempts: 2,
        baseDelayMs: 1,
        maxDelayMs: 2,
        shouldRetry: (error) => isTransientRequestError(error),
      }),
    ).resolves.toEqual({ ok: true });

    expect(request).toHaveBeenCalledTimes(2);
  });

  it("does not retry deterministic contract failures", async () => {
    const request = vi.fn<() => Promise<{ ok: true }>>().mockRejectedValue(
      new ContractValidationError({
        context: "/system/dashboard",
        direction: "response",
        message: "Contrato invalido de response em /system/dashboard",
      }),
    );

    await expect(
      executeContractRequestWithRetry(request, {
        attempts: 3,
        shouldRetry: (error) => isTransientRequestError(error),
      }),
    ).rejects.toBeInstanceOf(ContractValidationError);

    expect(request).toHaveBeenCalledTimes(1);
  });
});
