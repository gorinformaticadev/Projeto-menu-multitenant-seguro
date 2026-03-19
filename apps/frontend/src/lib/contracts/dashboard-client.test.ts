import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_VERSION_HEADER } from "@contracts/http";
import {
  getSystemDashboard,
  getSystemDashboardLayout,
} from "@/lib/contracts/dashboard-client";
import api from "@/lib/api";

vi.mock("@/lib/api", () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

describe("dashboard-client contract enforcement", () => {
  const mockedApi = vi.mocked(api);
  const buildAggregateResponse = () => ({
    generatedAt: new Date().toISOString(),
    responseTimeMs: 10,
    filtersApplied: {
      periodMinutes: 60,
      tenantId: null,
      severity: "all",
    },
    version: {
      status: "ok",
      version: "1.0.0",
      commitSha: null,
      buildDate: null,
      branch: null,
      source: "test",
    },
    uptime: {
      status: "ok",
      seconds: 60,
      human: "00:01:00",
      startedAt: new Date().toISOString(),
    },
    maintenance: {
      status: "ok",
      enabled: false,
      reason: null,
      etaSeconds: null,
      startedAt: null,
    },
    system: { status: "restricted" },
    cpu: { status: "restricted" },
    memory: { status: "restricted" },
    disk: { status: "restricted" },
    database: { status: "restricted" },
    redis: { status: "restricted" },
    workers: { status: "restricted" },
    api: { status: "unavailable", error: "telemetry offline" },
    routeLatency: { status: "restricted" },
    routeErrors: { status: "restricted" },
    security: { status: "restricted" },
    backup: { status: "restricted" },
    jobs: { status: "restricted" },
    errors: { status: "restricted" },
    tenants: { status: "restricted" },
    notifications: {
      status: "ok",
      criticalUnread: 0,
      criticalRecent: 0,
      operationalRecentCount: 0,
      recentOperationalAlerts: [],
    },
    widgets: { available: ["version"] },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unsupported dashboard query params before the request", async () => {
    await expect(
      getSystemDashboard({
        periodMinutes: 60,
        severity: "all",
        unsupported: true,
      } as never),
    ).rejects.toThrow(/Contrato invalido de request/i);

    expect(mockedApi.get).not.toHaveBeenCalled();
  });

  it("rejects malformed layout responses", async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        role: "SUPER_ADMIN",
        filtersJson: {
          unsupported: true,
        },
      },
    });

    await expect(getSystemDashboardLayout()).rejects.toThrow(/Contrato invalido de response/i);
  });

  it("keeps a new frontend compatible with an older backend as long as the v1 body still matches the contract", async () => {
    mockedApi.get.mockResolvedValue({
      headers: {
        [API_VERSION_HEADER]: "1",
      },
      data: {
        ...buildAggregateResponse(),
        notifications: {
          status: "ok",
          criticalUnread: 0,
          criticalRecent: 0,
          operationalRecentCount: 1,
          recentOperationalAlerts: [
            {
              id: "alert-1",
              title: "CPU alta",
              body: "Uso elevado detectado",
              severity: "critical",
              createdAt: new Date().toISOString(),
            },
          ],
        },
      },
    });

    await expect(
      getSystemDashboard({
        periodMinutes: 60,
        severity: "all",
      }),
    ).resolves.toMatchObject({
      widgets: { available: ["version"] },
    });
  });

  it("rejects additive response fields from a newer backend when the shared contract was not updated", async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        ...buildAggregateResponse(),
        rogueMetric: {
          enabled: true,
        },
      },
    });

    await expect(
      getSystemDashboard({
        periodMinutes: 60,
        severity: "all",
      }),
    ).rejects.toThrow(/Contrato invalido de response/i);
  });
});
