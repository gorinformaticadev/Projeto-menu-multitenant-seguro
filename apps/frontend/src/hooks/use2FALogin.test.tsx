import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { use2FALogin } from "@/hooks/use2FALogin";

const { authMock } = vi.hoisted(() => ({
  authMock: {
    loginWithCredentials: vi.fn(),
    loginWith2FA: vi.fn(),
    completeTwoFactorEnrollment: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authMock,
}));

describe("use2FALogin", () => {
  beforeEach(() => {
    authMock.loginWithCredentials.mockReset();
    authMock.loginWith2FA.mockReset();
    authMock.completeTwoFactorEnrollment.mockReset();
  });

  it("entra no estágio de 2FA quando o backend retorna requires2FA pelo contrato formal", async () => {
    authMock.loginWithCredentials.mockResolvedValue({
      success: false,
      requires2FA: true,
      mustEnrollTwoFactor: false,
    });

    const { result } = renderHook(() => use2FALogin());

    let loginResult:
      | { success: boolean; requires2FA?: boolean; mustEnrollTwoFactor?: boolean }
      | undefined;

    await act(async () => {
      loginResult = await result.current.attemptLogin("admin@example.com", "SenhaValida!123");
    });

    expect(loginResult).toEqual({
      success: false,
      requires2FA: true,
      mustEnrollTwoFactor: false,
    });
    expect(result.current.requires2FA).toBe(true);
    expect(result.current.mustEnrollTwoFactor).toBe(false);
    expect(result.current.credentials).toEqual({
      email: "admin@example.com",
      password: "SenhaValida!123",
    });
  });

  it("entra no estágio de enrollment quando o backend retorna mustEnrollTwoFactor pelo contrato formal", async () => {
    authMock.loginWithCredentials.mockResolvedValue({
      success: false,
      requires2FA: false,
      mustEnrollTwoFactor: true,
    });

    const { result } = renderHook(() => use2FALogin());

    let loginResult:
      | { success: boolean; requires2FA?: boolean; mustEnrollTwoFactor?: boolean }
      | undefined;

    await act(async () => {
      loginResult = await result.current.attemptLogin("admin@example.com", "SenhaValida!123");
    });

    expect(loginResult).toEqual({
      success: false,
      requires2FA: false,
      mustEnrollTwoFactor: true,
    });
    expect(result.current.requires2FA).toBe(false);
    expect(result.current.mustEnrollTwoFactor).toBe(true);
  });
});
