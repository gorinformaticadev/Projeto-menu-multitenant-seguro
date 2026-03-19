import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_VERSION_HEADER } from "@contracts/http";
import {
  getAuthenticatedUser,
  loginWithPassword,
} from "@/lib/contracts/auth-client";
import api from "@/lib/api";

vi.mock("@/lib/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("auth-client contract enforcement", () => {
  const mockedApi = vi.mocked(api);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unsupported login fields before sending the request", async () => {
    await expect(
      loginWithPassword({
        email: "admin@example.com",
        password: "secret123",
        severity: "critical",
      } as never),
    ).rejects.toThrow(/Contrato invalido de request/i);

    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it("rejects malformed auth responses", async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        id: "user-1",
      },
    });

    await expect(getAuthenticatedUser()).rejects.toThrow(/Contrato invalido de response/i);
  });

  it("keeps a new frontend compatible with an older backend response when the body still matches the shared contract", async () => {
    mockedApi.get.mockResolvedValue({
      headers: {
        [API_VERSION_HEADER]: "1",
      },
      data: {
        id: "user-1",
        email: "admin@example.com",
        name: "Admin",
        role: "SUPER_ADMIN",
        tenantId: null,
      },
    });

    await expect(getAuthenticatedUser()).resolves.toMatchObject({
      id: "user-1",
      role: "SUPER_ADMIN",
    });
  });
});
