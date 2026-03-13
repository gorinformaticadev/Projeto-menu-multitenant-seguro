import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SecuritySettingsPage from "@/app/configuracoes/seguranca/page";
import type { SecuritySettingItem } from "@/app/configuracoes/seguranca/security-settings.types";

const { apiMock, toastMock, useAuthMock } = vi.hoisted(() => ({
  apiMock: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
  useAuthMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  default: apiMock,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

const buildSetting = (overrides: Partial<SecuritySettingItem>): SecuritySettingItem => ({
  key: "notifications.enabled",
  label: "Notificações do sistema",
  description: "Ativa ou desativa o envio de notificações do sistema.",
  category: "notifications",
  type: "boolean",
  allowedInPanel: true,
  editableInPanel: true,
  restartRequired: false,
  requiresConfirmation: false,
  sensitive: false,
  valueHidden: false,
  resolvedValue: true,
  resolvedSource: "env",
  hasDatabaseOverride: false,
  lastUpdatedAt: null,
  lastUpdatedBy: null,
  ...overrides,
});

const buildReadResponse = (items: SecuritySettingItem[]) => ({
  data: {
    data: items,
    meta: {
      total: items.length,
      categories: [...new Set(items.map((item) => item.category))],
    },
  },
});

function deferredPromise<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe("/configuracoes/seguranca", () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({
      user: {
        id: "super-admin-1",
        email: "super-admin@example.com",
        name: "Super Admin",
        role: "SUPER_ADMIN",
      },
      loading: false,
    });
    apiMock.get.mockReset();
    apiMock.put.mockReset();
    apiMock.post.mockReset();
    toastMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza loading enquanto a lista está carregando", () => {
    apiMock.get.mockReturnValue(new Promise(() => undefined));

    render(<SecuritySettingsPage />);

    expect(screen.getByText(/Carregando configurações dinâmicas/i)).toBeInTheDocument();
  });

  it("renderiza erro coerente para 403", async () => {
    apiMock.get.mockRejectedValue({
      response: {
        status: 403,
        data: {
          message: "forbidden",
        },
      },
    });

    render(<SecuritySettingsPage />);

    expect(await screen.findByText(/Acesso negado/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Apenas SUPER_ADMIN pode visualizar ou alterar estas configurações/i),
    ).toBeInTheDocument();
  });

  it("renderiza erro coerente para 401", async () => {
    apiMock.get.mockRejectedValue({
      response: {
        status: 401,
        data: {
          message: "unauthorized",
        },
      },
    });

    render(<SecuritySettingsPage />);

    expect(await screen.findByText(/Sessão expirada/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Faça login novamente para acessar as configurações de segurança/i),
    ).toBeInTheDocument();
  });

  it("renderiza a lista com label, descrição, badge e toggle quando aplicável", async () => {
    apiMock.get.mockResolvedValue(
      buildReadResponse([
        buildSetting({}),
      ]),
    );

    render(<SecuritySettingsPage />);

    expect(await screen.findByText("Notificações do sistema")).toBeInTheDocument();
    expect(screen.getByText(/Ativa ou desativa o envio de notificações/i)).toBeInTheDocument();
    expect(screen.getByTestId("security-setting-origin-notifications.enabled")).toHaveTextContent("ENV");
    expect(screen.getByRole("switch", { name: /Alternar Notificações do sistema/i })).toBeInTheDocument();
  });

  it("não permite edição quando editableInPanel=false", async () => {
    apiMock.get.mockResolvedValue(
      buildReadResponse([
        buildSetting({
          key: "security.headers.enabled",
          label: "Headers de segurança",
          category: "security",
          editableInPanel: false,
          resolvedValue: true,
        }),
      ]),
    );

    render(<SecuritySettingsPage />);

    const control = await screen.findByRole("switch", { name: /Headers de segurança somente leitura/i });
    expect(control).toBeDisabled();
    expect(screen.getByText(/Somente leitura/i)).toBeInTheDocument();
  });

  it("nunca exibe valor real quando valueHidden=true", async () => {
    apiMock.get.mockResolvedValue(
      buildReadResponse([
        buildSetting({
          key: "security.rate_limit.enabled",
          label: "Rate limit global",
          category: "security",
          editableInPanel: false,
          valueHidden: true,
          sensitive: true,
          resolvedValue: true,
        }),
      ]),
    );

    render(<SecuritySettingsPage />);

    expect(await screen.findByText("Rate limit global")).toBeInTheDocument();
    expect(screen.getByText("Valor protegido")).toBeInTheDocument();
    expect(screen.queryByText("Ativado")).not.toBeInTheDocument();
  });

  it("nao exibe restore fallback quando nao existe override", async () => {
    apiMock.get.mockResolvedValue(buildReadResponse([buildSetting({ hasDatabaseOverride: false })]));

    render(<SecuritySettingsPage />);

    expect(await screen.findByText("Notificações do sistema")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Restaurar fallback/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Sem override em banco/i)).toBeInTheDocument();
  });

  it("chama o endpoint correto em alteração válida e atualiza a origem para Painel", async () => {
    apiMock.get.mockResolvedValue(buildReadResponse([buildSetting({})]));
    apiMock.put.mockResolvedValue({
      data: {
        action: "update",
        setting: buildSetting({
          resolvedValue: false,
          resolvedSource: "database",
          hasDatabaseOverride: true,
          lastUpdatedAt: "2026-03-13T17:00:00.000Z",
          lastUpdatedBy: {
            userId: "super-admin-1",
            email: "super-admin@example.com",
            name: "Super Admin",
          },
        }),
      },
    });

    render(<SecuritySettingsPage />);

    const user = userEvent.setup();
    const toggle = await screen.findByRole("switch", { name: /Alternar Notificações do sistema/i });
    await user.click(toggle);

    expect(apiMock.put).toHaveBeenCalledWith("/system/settings/panel/notifications.enabled", {
      value: false,
    });

    await waitFor(() => {
      expect(screen.getByTestId("security-setting-origin-notifications.enabled")).toHaveTextContent("Painel");
    });
    expect(screen.getByRole("button", { name: /Restaurar fallback/i })).toBeInTheDocument();
  });

  it("reverte o optimistic update em caso de erro de API", async () => {
    const deferred = deferredPromise<unknown>();
    apiMock.get.mockResolvedValue(buildReadResponse([buildSetting({})]));
    apiMock.put.mockReturnValue(deferred.promise);

    render(<SecuritySettingsPage />);

    const user = userEvent.setup();
    const toggle = await screen.findByRole("switch", { name: /Alternar Notificações do sistema/i });
    await user.click(toggle);

    expect(screen.getByTestId("security-setting-origin-notifications.enabled")).toHaveTextContent("Painel");

    deferred.reject({
      response: {
        data: {
          message: "db offline",
        },
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId("security-setting-origin-notifications.enabled")).toHaveTextContent("ENV");
    });
  });

  it("restore fallback chama o endpoint correto e some quando não há override", async () => {
    apiMock.get.mockResolvedValue(
      buildReadResponse([
        buildSetting({
          resolvedSource: "database",
          hasDatabaseOverride: true,
          lastUpdatedAt: "2026-03-13T17:00:00.000Z",
        }),
      ]),
    );
    apiMock.post.mockResolvedValue({
      data: {
        action: "restore_fallback",
        setting: buildSetting({
          resolvedSource: "env",
          hasDatabaseOverride: false,
        }),
      },
    });

    render(<SecuritySettingsPage />);

    const user = userEvent.setup();
    const restoreButton = await screen.findByRole("button", { name: /Restaurar fallback/i });
    await user.click(restoreButton);

    expect(apiMock.post).toHaveBeenCalledWith(
      "/system/settings/panel/notifications.enabled/restore-fallback",
      {},
    );

    await waitFor(() => {
      expect(screen.getByTestId("security-setting-origin-notifications.enabled")).toHaveTextContent("ENV");
    });
    expect(screen.queryByRole("button", { name: /Restaurar fallback/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Sem override em banco/i)).toBeInTheDocument();
  });

  it("exige confirmação para chaves com requiresConfirmation=true", async () => {
    apiMock.get.mockResolvedValue(
      buildReadResponse([
        buildSetting({
          key: "security.module_upload.enabled",
          label: "Upload de módulos",
          category: "security",
          requiresConfirmation: true,
        }),
      ]),
    );
    apiMock.put.mockResolvedValue({
      data: {
        action: "update",
        setting: buildSetting({
          key: "security.module_upload.enabled",
          label: "Upload de módulos",
          category: "security",
          requiresConfirmation: true,
          resolvedValue: false,
          resolvedSource: "database",
          hasDatabaseOverride: true,
        }),
      },
    });

    render(<SecuritySettingsPage />);

    const user = userEvent.setup();
    const toggle = await screen.findByRole("switch", { name: /Alternar Upload de módulos/i });
    await user.click(toggle);

    expect(apiMock.put).not.toHaveBeenCalled();
    expect(screen.getByText(/Confirmar alteração/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Cancelar/i }));
    expect(apiMock.put).not.toHaveBeenCalled();

    await user.click(toggle);
    await user.click(screen.getByRole("button", { name: /Confirmar/i }));

    await waitFor(() => {
      expect(apiMock.put).toHaveBeenCalledWith("/system/settings/panel/security.module_upload.enabled", {
        value: false,
      });
    });
  });

  it("mostra estado vazio quando a API retorna lista vazia", async () => {
    apiMock.get.mockResolvedValue(buildReadResponse([]));

    render(<SecuritySettingsPage />);

    expect(
      await screen.findByText(/Nenhuma configuração dinâmica aprovada foi encontrada/i),
    ).toBeInTheDocument();
  });
});
