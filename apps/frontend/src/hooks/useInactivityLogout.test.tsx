import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";

const { useAuthMock, toastMock, dismissMock, logoutMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  toastMock: vi.fn(),
  dismissMock: vi.fn(),
  logoutMock: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: toastMock,
    dismiss: dismissMock,
  }),
}));

function Harness({ timeoutMinutes }: { timeoutMinutes: number }) {
  useInactivityLogout(timeoutMinutes);
  return null;
}

describe("useInactivityLogout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useAuthMock.mockReset();
    toastMock.mockReset();
    dismissMock.mockReset();
    logoutMock.mockReset();
    toastMock.mockReturnValue({
      id: "warning-toast-id",
      dismiss: vi.fn(),
      update: vi.fn(),
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("nao dispara aviso imediatamente apos login em timeout normal", () => {
    let authState: { user: { id: string } | null; logout: typeof logoutMock } = {
      user: null,
      logout: logoutMock,
    };
    useAuthMock.mockImplementation(() => authState);

    const { rerender } = render(<Harness timeoutMinutes={30} />);
    authState = { user: { id: "user-1" }, logout: logoutMock };
    rerender(<Harness timeoutMinutes={30} />);

    vi.advanceTimersByTime(5_000);

    expect(
      toastMock.mock.calls.some(
        ([payload]) => payload?.title === "Sessão expirando",
      ),
    ).toBe(false);
    expect(logoutMock).not.toHaveBeenCalled();
  });

  it("dispensa o aviso de expiracao quando ha atividade", () => {
    useAuthMock.mockReturnValue({
      user: { id: "user-1" },
      logout: logoutMock,
    });

    render(<Harness timeoutMinutes={2} />);

    vi.advanceTimersByTime(60_000);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Sessão expirando" }),
    );

    document.dispatchEvent(new Event("mousemove"));
    expect(dismissMock).toHaveBeenCalledWith("warning-toast-id");
  });

  it("nao entra em loop de aviso com timeout curto", () => {
    useAuthMock.mockReturnValue({
      user: { id: "user-1" },
      logout: logoutMock,
    });

    render(<Harness timeoutMinutes={1} />);
    vi.advanceTimersByTime(100);

    expect(
      toastMock.mock.calls.some(
        ([payload]) => payload?.title === "Sessão expirando",
      ),
    ).toBe(false);

    vi.advanceTimersByTime(59_900);
    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Sessão expirada" }),
    );
  });
});
