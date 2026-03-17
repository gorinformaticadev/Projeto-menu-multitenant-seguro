import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SecuritySettingsPage from "@/app/configuracoes/seguranca/page";
import type { SecuritySettingItem } from "@/app/configuracoes/seguranca/security-settings.types";

const { apiMock, toastMock, useAuthMock, refreshConfigMock } = vi.hoisted(() => ({
  apiMock: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
  useAuthMock: vi.fn(),
  toastMock: vi.fn(),
  refreshConfigMock: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  default: apiMock,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/contexts/SecurityConfigContext", () => ({
  useSecurityConfig: () => ({
    config: null,
    loading: false,
    refreshConfig: refreshConfigMock,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

const buildLegacySecurityConfig = () => ({
  id: "security-config-1",
  loginMaxAttempts: 5,
  loginLockDurationMinutes: 30,
  loginWindowMinutes: 15,
  globalMaxRequests: 120,
  globalWindowMinutes: 1,
  passwordMinLength: 8,
  passwordRequireUppercase: true,
  passwordRequireLowercase: true,
  passwordRequireNumbers: true,
  passwordRequireSpecial: true,
  accessTokenExpiresIn: "15m",
  refreshTokenExpiresIn: "7d",
  twoFactorEnabled: true,
  twoFactorRequired: false,
  sessionTimeoutMinutes: 30,
  backupRateLimitPerHour: 5,
  restoreRateLimitPerHour: 2,
  updateRateLimitPerHour: 1,
  rateLimitDevEnabled: true,
  rateLimitProdEnabled: true,
  rateLimitDevRequests: 1000,
  rateLimitProdRequests: 120,
  rateLimitDevWindow: 1,
  rateLimitProdWindow: 1,
  updatedAt: "2026-03-13T15:00:00.000Z",
  updatedBy: "super-admin-1",
});

it("permite que submit antigo e toggle dinamico coexistam sem derrubar a pagina", async () => {
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
    refreshConfigMock.mockReset();
    refreshConfigMock.mockResolvedValue(undefined);
    localStorage.clear();

    installDefaultGetHandlers([buildSetting({})]);
    apiMock.put.mockImplementation((url: string, payload: unknown) => {
      if (url === "/system/settings/panel/notifications.enabled") {
        return Promise.resolve({
          data: {
            action: "update",
            setting: buildSetting({
              resolvedValue: false,
              resolvedSource: "database",
              hasDatabaseOverride: true,
            }),
          },
        });
      }

      if (url === "/security-config") {
        return Promise.resolve({ data: { ...buildLegacySecurityConfig(), ...(payload as object) } });
      }

      throw new Error(`Unhandled PUT ${url}`);
    });

    render(<SecuritySettingsPage />);

    const user = userEvent.setup();
    const toggle = await screen.findByRole("switch", { name: /Alternar Notificacoes do sistema/i });
    await user.click(toggle);

    await waitFor(() => {
      expect(screen.getByTestId("security-setting-origin-notifications.enabled")).toHaveTextContent("Painel");
    });

    const loginAttemptsInput = screen.getByRole("spinbutton", {
      name: /Máximo de Tentativas de Login/i,
    });
    await user.clear(loginAttemptsInput);
    await user.type(loginAttemptsInput, "11");
    await user.click(screen.getByRole("button", { name: /Salvar Alterações/i }));

    await waitFor(() => {
      expect(apiMock.put).toHaveBeenCalledWith(
        "/security-config",
        expect.objectContaining({
          loginMaxAttempts: 11,
        }),
      );
    });

    expect(screen.getByText(/Controle de Tentativas de Login/i)).toBeInTheDocument();
    expect(screen.getByTestId("dynamic-security-settings-section")).toBeInTheDocument();
  });

const buildSetting = (overrides: Partial<SecuritySettingItem>): SecuritySettingItem => ({
  key: "notifications.enabled",
  label: "Notificacoes do sistema",
  description: "Ativa ou desativa o envio de notificacoes do sistema.",
  operationalNotes: [],
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

const buildEmailProvidersResponse = () => ({
  data: [
    {
      providerName: "Gmail",
      smtpHost: "smtp.gmail.com",
      smtpPort: 587,
      encryption: "STARTTLS",
      authMethod: "PLAIN",
      description: "Google Workspace / Gmail",
    },
  ],
});

const buildEmailConfigListResponse = () => ({
  data: [],
});

const buildActiveEmailConfigResponse = () => ({
  data: {
    id: "email-config-1",
    providerName: "Gmail",
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    encryption: "STARTTLS",
    authMethod: "PLAIN",
    isActive: true,
    createdAt: "2026-03-13T15:00:00.000Z",
    updatedAt: "2026-03-13T15:00:00.000Z",
  },
});

const buildEmailCredentialsResponse = () => ({
  data: {
    smtpUsername: "mailer@example.com",
  },
});

function installDefaultGetHandlers(dynamicItems: SecuritySettingItem[] = [buildSetting({})]) {
  apiMock.get.mockImplementation((url: string) => {
    switch (url) {
      case "/security-config":
        return Promise.resolve({ data: buildLegacySecurityConfig() });
      case "/system/settings/panel":
        return Promise.resolve(buildReadResponse(dynamicItems));
      case "/email-config/providers":
        return Promise.resolve(buildEmailProvidersResponse());
      case "/email-config":
        return Promise.resolve(buildEmailConfigListResponse());
      case "/email-config/active":
        return Promise.resolve(buildActiveEmailConfigResponse());
      case "/email-config/smtp-credentials":
        return Promise.resolve(buildEmailCredentialsResponse());
      default:
        throw new Error(`Unhandled GET ${url}`);
    }
  });
}

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
    refreshConfigMock.mockReset();
    refreshConfigMock.mockResolvedValue(undefined);
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("mantem a secao dinamica visivel enquanto as configuracoes antigas ainda estao carregando", async () => {
    apiMock.get.mockImplementation((url: string) => {
      switch (url) {
        case "/security-config":
          return new Promise(() => undefined);
        case "/system/settings/panel":
          return Promise.resolve(buildReadResponse([buildSetting({})]));
        case "/email-config/providers":
          return Promise.resolve(buildEmailProvidersResponse());
        case "/email-config":
          return Promise.resolve(buildEmailConfigListResponse());
        case "/email-config/active":
          return Promise.resolve(buildActiveEmailConfigResponse());
        case "/email-config/smtp-credentials":
          return Promise.resolve(buildEmailCredentialsResponse());
        default:
          throw new Error(`Unexpected GET ${url}`);
      }
    });

    render(<SecuritySettingsPage />);

    expect(screen.getByTestId("legacy-security-section-loading")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: /Notificacoes do sistema/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Configurações de Email/i)).toBeInTheDocument();
  });

  it("restaura todas as secoes antigas e integra a secao dinamica na mesma pagina", async () => {
    installDefaultGetHandlers([
      buildSetting({}),
      buildSetting({
        key: "security.module_upload.enabled",
        label: "Upload de modulos",
        category: "security",
      }),
    ]);

    render(<SecuritySettingsPage />);

    expect(await screen.findByText(/Controle de Tentativas de Login/i)).toBeInTheDocument();
    expect(screen.getByText(/Rate Limiting Global/i)).toBeInTheDocument();
    expect(screen.queryByText(/Rate Limiting de Endpoints Críticos/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Política de Senha/i)).toBeInTheDocument();
    expect(screen.getByText(/Autenticação de Dois Fatores \(2FA\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Tokens e Sessão/i)).toBeInTheDocument();
    const emailHeading = await screen.findByText(/Configurações de Email/i);
    const dynamicSection = await screen.findByTestId("dynamic-security-settings-section");
    expect(within(dynamicSection).getByText(/Configuracoes Dinamicas de Seguranca/i)).toBeInTheDocument();
    expect(within(dynamicSection).getByRole("heading", { name: /Notificacoes do sistema/i })).toBeInTheDocument();
    expect(Boolean(dynamicSection.compareDocumentPosition(emailHeading) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);

    expect(apiMock.get).toHaveBeenCalledWith("/security-config");
    expect(apiMock.get).toHaveBeenCalledWith("/system/settings/panel");
    expect(apiMock.get).toHaveBeenCalledWith("/email-config/providers");
    expect(apiMock.get).toHaveBeenCalledWith("/email-config");
    expect(apiMock.get).toHaveBeenCalledWith("/email-config/active");
    expect(apiMock.get).toHaveBeenCalledWith("/email-config/smtp-credentials");
  });

  it("mantem o endpoint antigo /security-config para salvar as configuracoes existentes", async () => {
    installDefaultGetHandlers();
    apiMock.put.mockImplementation((url: string, payload: unknown) => {
      if (url === "/security-config") {
        return Promise.resolve({ data: { ...buildLegacySecurityConfig(), ...(payload as object) } });
      }
      throw new Error(`Unhandled PUT ${url}`);
    });

    render(<SecuritySettingsPage />);

    const user = userEvent.setup();
    const loginAttemptsInput = await screen.findByRole("spinbutton", {
      name: /Máximo de Tentativas de Login/i,
    });
    await user.clear(loginAttemptsInput);
    await user.type(loginAttemptsInput, "7");
    await user.click(screen.getByRole("button", { name: /Salvar Altera/i }));

    await waitFor(() => {
      expect(apiMock.put).toHaveBeenCalledWith(
        "/security-config",
        expect.objectContaining({
          loginMaxAttempts: 7,
          loginLockDurationMinutes: 30,
          globalMaxRequests: 120,
          passwordMinLength: 8,
          accessTokenExpiresIn: "15m",
          refreshTokenExpiresIn: "7d",
        }),
      );
    });
    expect(refreshConfigMock).toHaveBeenCalledTimes(1);
  });

  it("mantem os dois botoes antigos de salvar equivalentes para /security-config", async () => {
    installDefaultGetHandlers();
    apiMock.put.mockImplementation((url: string, payload: unknown) => {
      if (url === "/security-config") {
        return Promise.resolve({ data: { ...buildLegacySecurityConfig(), ...(payload as object) } });
      }
      throw new Error(`Unhandled PUT ${url}`);
    });

    render(<SecuritySettingsPage />);

    const user = userEvent.setup();
    expect(await screen.findByRole("button", { name: /Salvar Alterações/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar Todas as Alterações/i })).toBeInTheDocument();

    const loginAttemptsInput = screen.getByRole("spinbutton", {
      name: /Máximo de Tentativas de Login/i,
    });
    await user.clear(loginAttemptsInput);
    await user.type(loginAttemptsInput, "9");
    await user.click(screen.getByRole("button", { name: /Salvar Todas as Alterações/i }));

    await waitFor(() => {
      expect(apiMock.put).toHaveBeenCalledWith(
        "/security-config",
        expect.objectContaining({
          loginMaxAttempts: 9,
        }),
      );
    });
  });

  it("mantem os toggles dinamicos funcionando sem remover os controles antigos", async () => {
    installDefaultGetHandlers([buildSetting({})]);
    apiMock.put.mockImplementation((url: string) => {
      if (url === "/system/settings/panel/notifications.enabled") {
        return Promise.resolve({
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
      }

      if (url === "/security-config") {
        return Promise.resolve({ data: buildLegacySecurityConfig() });
      }

      throw new Error(`Unhandled PUT ${url}`);
    });

    render(<SecuritySettingsPage />);

    const user = userEvent.setup();
    const toggle = await screen.findByRole("switch", { name: /Alternar Notificacoes do sistema/i });
    await user.click(toggle);

    expect(apiMock.put).toHaveBeenCalledWith("/system/settings/panel/notifications.enabled", {
      value: false,
    });

    await waitFor(() => {
      expect(screen.getByTestId("security-setting-origin-notifications.enabled")).toHaveTextContent("Painel");
    });
    expect(screen.getByText(/Controle de Tentativas de Login/i)).toBeInTheDocument();
  });

  it("restore fallback dinamico continua funcionando sem esconder as secoes antigas", async () => {
    installDefaultGetHandlers([
      buildSetting({
        resolvedSource: "database",
        hasDatabaseOverride: true,
        lastUpdatedAt: "2026-03-13T17:00:00.000Z",
      }),
    ]);
    apiMock.post.mockImplementation((url: string) => {
      if (url === "/system/settings/panel/notifications.enabled/restore-fallback") {
        return Promise.resolve({
          data: {
            action: "restore_fallback",
            setting: buildSetting({
              resolvedSource: "env",
              hasDatabaseOverride: false,
            }),
          },
        });
      }
      throw new Error(`Unhandled POST ${url}`);
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
    expect(screen.getByText(/Tokens e Sessão/i)).toBeInTheDocument();
  });

  it("explica origens e bloqueios operacionais na secao dinamica sem depender do icone de ajuda", async () => {
    installDefaultGetHandlers([
      buildSetting({}),
      buildSetting({
        key: "security.headers.enabled",
        label: "Headers de seguranca",
        category: "security",
        editableInPanel: false,
        restartRequired: true,
      }),
    ]);

    render(<SecuritySettingsPage />);

    const dynamicSection = await screen.findByTestId("dynamic-security-settings-section");
    expect(within(dynamicSection).getByText(/Como ler esta secao/i)).toBeInTheDocument();
    expect(
      within(dynamicSection).getByText(/As origens mostram de onde vem o valor efetivo/i),
    ).toBeInTheDocument();
    expect(
      within(dynamicSection).getByText(/confirmacao aparece so para acoes editaveis; reinicio indica efeito apenas apos restart/i),
    ).toBeInTheDocument();
  });

  it("nao oferece restore fallback para item somente leitura com override em banco", async () => {
    installDefaultGetHandlers([
      buildSetting({
        key: "security.headers.enabled",
        label: "Headers de seguranca",
        category: "security",
        editableInPanel: false,
        sensitive: false,
        valueHidden: false,
        resolvedValue: true,
        resolvedSource: "database",
        hasDatabaseOverride: true,
        restartRequired: true,
      }),
    ]);

    render(<SecuritySettingsPage />);

    const readonlyRow = await screen.findByTestId("security-setting-row-security.headers.enabled");
    expect(
      within(readonlyRow).getByText(/Override em banco ativo; restauracao bloqueada neste painel/i),
    ).toBeInTheDocument();
    expect(
      within(readonlyRow).queryByRole("button", { name: /Restaurar fallback/i }),
    ).not.toBeInTheDocument();
  });

  it("nao permite editar item dinamico somente leitura nem expor valor protegido", async () => {
    installDefaultGetHandlers([
      buildSetting({
        key: "security.internal.protected.enabled",
        label: "Controle protegido",
        category: "security",
        editableInPanel: false,
        valueHidden: true,
        sensitive: true,
        resolvedValue: true,
      }),
    ]);

    render(<SecuritySettingsPage />);

    expect(await screen.findByText(/Controle protegido/i)).toBeInTheDocument();
    const readonlyRow = screen.getByTestId("security-setting-row-security.internal.protected.enabled");
    expect(within(readonlyRow).getAllByText(/Somente leitura/i).length).toBeGreaterThan(0);
    expect(within(readonlyRow).getAllByText(/Valor protegido/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("switch", { name: /Alternar Controle protegido/i })).not.toBeInTheDocument();
  });

  it("mostra as informacoes somente quando o icone e clicado", async () => {
    installDefaultGetHandlers([
      buildSetting({
        key: "security.module_upload.enabled",
        label: "Upload de modulos",
        description: "Permite instalar ou bloquear o upload de modulos no sistema.",
        category: "security",
        operationalNotes: [
          "Em development, upload, uninstall e reload continuam liberados automaticamente independentemente deste toggle.",
        ],
      }),
    ]);

    render(<SecuritySettingsPage />);

    expect(await screen.findByText(/Controle de Tentativas de Login/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/Configure o bloqueio automático de contas após múltiplas tentativas de login falhas/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Ativa ou desativa o envio de notificacoes do sistema\./i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/upload, uninstall e reload continuam liberados automaticamente/i),
    ).not.toBeInTheDocument();

    const user = userEvent.setup();
    expect(
      screen.getByRole("spinbutton", { name: /Máximo de Tentativas de Login/i }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: /Ajuda da seção de controle de tentativas de login/i,
      }),
    );
    expect(
      await screen.findByText(/Configure o bloqueio automático de contas após múltiplas tentativas de login falhas/i),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /Ajuda da configuracao dinamica Upload de modulos/i,
      }),
    );
    expect(await screen.findByText(/Permite instalar ou bloquear o upload de modulos no sistema\./i)).toBeInTheDocument();
    expect(
      await screen.findByText(/upload, uninstall e reload continuam liberados automaticamente independentemente deste toggle/i),
    ).toBeInTheDocument();
  });

  it("deixa toggles desligados visiveis em vermelho na pagina", async () => {
    installDefaultGetHandlers([
      buildSetting({
        key: "security.headers.enabled",
        label: "Headers de seguranca",
        category: "security",
        editableInPanel: false,
        valueHidden: false,
        sensitive: false,
        resolvedValue: false,
        restartRequired: true,
      }),
    ]);

    render(<SecuritySettingsPage />);

    const readonlyToggle = await screen.findByRole("switch", {
      name: /Headers de seguranca somente leitura/i,
    });
    const legacyUncheckedToggle = screen.getByRole("switch", {
      name: /Tornar 2FA Obrigatório/i,
    });

    expect(readonlyToggle).toHaveClass("data-[state=unchecked]:bg-destructive/80");
    expect(legacyUncheckedToggle).toHaveClass("data-[state=unchecked]:bg-destructive/80");
  });

  it("exibe security.headers.enabled como somente leitura visivel, com reinicio explicito e observacao operacional", async () => {
    installDefaultGetHandlers([
      buildSetting({
        key: "security.headers.enabled",
        label: "Headers de seguranca",
        category: "security",
        editableInPanel: false,
        sensitive: false,
        valueHidden: false,
        resolvedValue: true,
        restartRequired: true,
        operationalNotes: [
          "Mudancas nesta chave so passam a valer apos reiniciar o processo do backend.",
          "CSP avancado e protecao CSRF continuam separados deste toggle.",
        ],
      }),
    ]);

    render(<SecuritySettingsPage />);

    const readonlyToggle = await screen.findByRole("switch", {
      name: /Headers de seguranca somente leitura/i,
    });
    const readonlyRow = screen.getByTestId("security-setting-row-security.headers.enabled");
    expect(readonlyToggle).toBeInTheDocument();
    expect(within(readonlyRow).getByText(/Requer reinicio/i)).toBeInTheDocument();
    expect(within(readonlyRow).queryByText(/Exige confirmacao/i)).not.toBeInTheDocument();
    expect(within(readonlyRow).queryByText(/Valor protegido/i)).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", {
        name: /Ajuda da configuracao dinamica Headers de seguranca/i,
      }),
    );

    expect(
      await screen.findByText(/Mudancas nesta chave so passam a valer apos reiniciar o processo do backend/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/CSP avancado e protecao CSRF continuam separados deste toggle/i),
    ).toBeInTheDocument();
  });

  it("exibe security.csrf.enabled como somente leitura visivel, com risco operacional explicito", async () => {
    installDefaultGetHandlers([
      buildSetting({
        key: "security.csrf.enabled",
        label: "Protecao CSRF",
        category: "security",
        editableInPanel: false,
        sensitive: false,
        valueHidden: false,
        resolvedValue: false,
        restartRequired: false,
        operationalNotes: [
          "Cada processo pode levar ate 15 segundos para refletir a mudanca por causa do cache local do guard.",
          "Quando habilitado, clientes reais precisam enviar cookie e header CSRF validos ou podem receber 403.",
          "Nesta fase o painel exibe o estado atual, mas mantem esta chave como somente leitura devido ao risco operacional.",
        ],
      }),
    ]);

    render(<SecuritySettingsPage />);

    const readonlyToggle = await screen.findByRole("switch", {
      name: /Protecao CSRF somente leitura/i,
    });
    const readonlyRow = screen.getByTestId("security-setting-row-security.csrf.enabled");
    expect(readonlyToggle).toBeInTheDocument();
    expect(within(readonlyRow).queryByText(/Valor protegido/i)).not.toBeInTheDocument();
    expect(within(readonlyRow).queryByText(/Requer reinicio/i)).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", {
        name: /Ajuda da configuracao dinamica Protecao CSRF/i,
      }),
    );

    expect(
      await screen.findByText(/Cada processo pode levar ate 15 segundos para refletir a mudanca/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/clientes reais precisam enviar cookie e header CSRF validos ou podem receber 403/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/mantem esta chave como somente leitura devido ao risco operacional/i),
    ).toBeInTheDocument();
  });

  it("exibe security.csp_advanced.enabled como somente leitura visivel, com escopo real e risco explicito para o frontend", async () => {
    installDefaultGetHandlers([
      buildSetting({
        key: "security.csp_advanced.enabled",
        label: "CSP avancado",
        description: "Ativa a politica CSP avancada aplicada pelo middleware global do backend.",
        category: "security",
        editableInPanel: false,
        sensitive: false,
        valueHidden: false,
        resolvedValue: false,
        restartRequired: false,
        operationalNotes: [
          "Controla apenas a sobrescrita da CSP avancada no CspMiddleware global. A CSP basica de security.headers.enabled continua separada.",
          "Cada processo pode levar ate 15 segundos para refletir a mudanca por causa do cache local do middleware.",
          "Quando habilitado, paginas e clientes reais podem falhar ao carregar scripts, estilos, imagens ou conexoes que nao estejam cobertos pela politica atual.",
          "Nesta fase o painel exibe o estado atual, mas mantem esta chave como somente leitura devido ao risco operacional para o frontend real.",
        ],
      }),
    ]);

    render(<SecuritySettingsPage />);

    const readonlyToggle = await screen.findByRole("switch", {
      name: /CSP avancado somente leitura/i,
    });
    const readonlyRow = screen.getByTestId("security-setting-row-security.csp_advanced.enabled");
    expect(readonlyToggle).toBeInTheDocument();
    expect(within(readonlyRow).queryByText(/Valor protegido/i)).not.toBeInTheDocument();
    expect(within(readonlyRow).queryByText(/Requer reinicio/i)).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", {
        name: /Ajuda da configuracao dinamica CSP avancado/i,
      }),
    );

    expect(
      await screen.findByText(/CspMiddleware global.*security\.headers\.enabled continua separada/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Cada processo pode levar ate 15 segundos para refletir a mudanca/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/paginas e clientes reais podem falhar ao carregar scripts, estilos, imagens ou conexoes/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/mantem esta chave como somente leitura devido ao risco operacional para o frontend real/i),
    ).toBeInTheDocument();
  });

  it("exibe security.websocket.enabled com escopo socket.io real e limite operacional explicito", async () => {
    installDefaultGetHandlers([
      buildSetting({
        key: "security.websocket.enabled",
        label: "Canal WebSocket realtime",
        description: "Ativa ou desativa o canal Socket.IO dos gateways realtime ativos do backend.",
        category: "security",
        editableInPanel: false,
        sensitive: false,
        valueHidden: false,
        resolvedValue: true,
        restartRequired: false,
        operationalNotes: [
          "Nesta etapa controla apenas os gateways Socket.IO ativos do backend. SSE e outros canais realtime continuam fora deste escopo.",
          "Conexoes ja abertas e ociosas podem permanecer ate nova interacao, emissao ou reconexao; este toggle nao faz dreno global instantaneo.",
          "Cada processo pode levar ate 15 segundos para refletir a mudanca por causa do cache local do resolvedor.",
          "Nesta fase o painel exibe o estado atual, mas mantem esta chave como somente leitura devido ao limite operacional do canal.",
        ],
      }),
    ]);

    render(<SecuritySettingsPage />);

    const readonlyToggle = await screen.findByRole("switch", {
      name: /Canal WebSocket realtime somente leitura/i,
    });
    const readonlyRow = screen.getByTestId("security-setting-row-security.websocket.enabled");
    expect(readonlyToggle).toBeInTheDocument();
    expect(within(readonlyRow).queryByText(/Valor protegido/i)).not.toBeInTheDocument();
    expect(within(readonlyRow).queryByText(/Requer reinicio/i)).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", {
        name: /Ajuda da configuracao dinamica Canal WebSocket realtime/i,
      }),
    );

    expect(
      await screen.findByText(/apenas os gateways Socket\.IO ativos do backend/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/nao faz dreno global instantaneo/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Cada processo pode levar ate 15 segundos para refletir a mudanca/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/mantem esta chave como somente leitura devido ao limite operacional do canal/i),
    ).toBeInTheDocument();
  });

  it("exibe notifications.push.enabled com escopo real de entrega, separacoes explicitas e confirmacao", async () => {
    installDefaultGetHandlers([
      buildSetting({
        key: "notifications.push.enabled",
        label: "Entrega Web Push",
        description:
          "Controla a tentativa real de envio Web Push para subscriptions ja registradas quando houver VAPID valido.",
        category: "notifications",
        editableInPanel: true,
        sensitive: false,
        valueHidden: false,
        resolvedValue: true,
        restartRequired: false,
        requiresConfirmation: true,
        operationalNotes: [
          "Controla apenas a tentativa de entrega push no PushNotificationService. Nao cria nem persiste notificacoes.",
          "Notifications.enabled continua controlando a criacao/persistencia da notificacao, e security.websocket.enabled continua controlando o canal realtime/socket.",
          "Disponibilidade de public key VAPID ou existencia de subscriptions nao equivale a entrega habilitada; se esta chave estiver desligada, o envio push nao e tentado.",
          "Cada processo pode levar ate 15 segundos para refletir a mudanca por causa do cache local do servico.",
        ],
      }),
    ]);

    render(<SecuritySettingsPage />);

    const liveToggle = await screen.findByRole("switch", {
      name: /Alternar Entrega Web Push/i,
    });
    const liveRow = screen.getByTestId("security-setting-row-notifications.push.enabled");
    expect(liveToggle).toBeInTheDocument();
    expect(within(liveRow).getByText(/Exige confirmacao/i)).toBeInTheDocument();
    expect(within(liveRow).queryByText(/Somente leitura/i)).not.toBeInTheDocument();
    expect(within(liveRow).queryByText(/Requer reinicio/i)).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", {
        name: /Ajuda da configuracao dinamica Entrega Web Push/i,
      }),
    );

    expect(
      await screen.findByText(/tentativa real de envio Web Push para subscriptions ja registradas/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Controla apenas a tentativa de entrega push no PushNotificationService/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Notifications\.enabled continua controlando a criacao\/persistencia da notificacao, e security\.websocket\.enabled continua controlando o canal realtime\/socket/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Disponibilidade de public key VAPID ou existencia de subscriptions nao equivale a entrega habilitada/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Cada processo pode levar ate 15 segundos para refletir a mudanca/i),
    ).toBeInTheDocument();
  });

  it("exige confirmacao explicita para chaves dinamicas marcadas com requiresConfirmation", async () => {
    installDefaultGetHandlers([
      buildSetting({
        key: "security.module_upload.enabled",
        label: "Upload de modulos",
        category: "security",
        requiresConfirmation: true,
      }),
    ]);
    apiMock.put.mockImplementation((url: string) => {
      if (url === "/system/settings/panel/security.module_upload.enabled") {
        return Promise.resolve({
          data: {
            action: "update",
            setting: buildSetting({
              key: "security.module_upload.enabled",
              label: "Upload de modulos",
              category: "security",
              requiresConfirmation: true,
              resolvedValue: false,
              resolvedSource: "database",
              hasDatabaseOverride: true,
            }),
          },
        });
      }
      throw new Error(`Unhandled PUT ${url}`);
    });

    render(<SecuritySettingsPage />);

    const user = userEvent.setup();
    const toggle = await screen.findByRole("switch", { name: /Alternar Upload de modulos/i });
    await user.click(toggle);

    expect(apiMock.put).not.toHaveBeenCalledWith("/system/settings/panel/security.module_upload.enabled", expect.anything());
    expect(screen.getByText(/Confirmar alteracao/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Cancelar/i }));
    expect(apiMock.put).not.toHaveBeenCalledWith("/system/settings/panel/security.module_upload.enabled", expect.anything());

    await user.click(toggle);
    await user.click(screen.getByRole("button", { name: /Confirmar/i }));

    await waitFor(() => {
      expect(apiMock.put).toHaveBeenCalledWith("/system/settings/panel/security.module_upload.enabled", {
        value: false,
      });
    });
  });

  it("reverte o optimistic update dinamico em caso de erro e preserva o restante da pagina", async () => {
    installDefaultGetHandlers([buildSetting({})]);
    const deferred = deferredPromise<unknown>();
    apiMock.put.mockImplementation((url: string) => {
      if (url === "/system/settings/panel/notifications.enabled") {
        return deferred.promise;
      }
      throw new Error(`Unhandled PUT ${url}`);
    });

    render(<SecuritySettingsPage />);

    const user = userEvent.setup();
    const toggle = await screen.findByRole("switch", { name: /Alternar Notificacoes do sistema/i });
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
    expect(screen.getByText(/Política de Senha/i)).toBeInTheDocument();
  });

  it("mantem a secao dinamica operante mesmo quando /security-config falha", async () => {
    apiMock.get.mockImplementation((url: string) => {
      switch (url) {
        case "/security-config":
          return Promise.reject({
            response: {
              status: 500,
              data: { message: "legacy offline" },
            },
          });
        case "/system/settings/panel":
          return Promise.resolve(buildReadResponse([buildSetting({})]));
        case "/email-config/providers":
          return Promise.resolve(buildEmailProvidersResponse());
        case "/email-config":
          return Promise.resolve(buildEmailConfigListResponse());
        case "/email-config/active":
          return Promise.resolve(buildActiveEmailConfigResponse());
        case "/email-config/smtp-credentials":
          return Promise.resolve(buildEmailCredentialsResponse());
        default:
          throw new Error(`Unhandled GET ${url}`);
      }
    });

    render(<SecuritySettingsPage />);

    expect(await screen.findByTestId("legacy-security-section-error")).toBeInTheDocument();
    expect(screen.getByText(/legacy offline/i)).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: /Notificacoes do sistema/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Configurações de Email/i)).toBeInTheDocument();
  });

  it("mantem a pagina antiga operante mesmo quando a API dinamica falha", async () => {
    apiMock.get.mockImplementation((url: string) => {
      switch (url) {
        case "/security-config":
          return Promise.resolve({ data: buildLegacySecurityConfig() });
        case "/system/settings/panel":
          return Promise.reject({
            response: {
              status: 403,
              data: { message: "forbidden" },
            },
          });
        case "/email-config/providers":
          return Promise.resolve(buildEmailProvidersResponse());
        case "/email-config":
          return Promise.resolve(buildEmailConfigListResponse());
        case "/email-config/active":
          return Promise.resolve(buildActiveEmailConfigResponse());
        case "/email-config/smtp-credentials":
          return Promise.resolve(buildEmailCredentialsResponse());
        default:
          throw new Error(`Unhandled GET ${url}`);
      }
    });

    render(<SecuritySettingsPage />);

    expect(await screen.findByText(/Controle de Tentativas de Login/i)).toBeInTheDocument();
    expect(await screen.findByText(/Acesso negado/i)).toBeInTheDocument();
    expect(screen.getByText(/Apenas SUPER_ADMIN pode visualizar ou alterar estas configuracoes dinamicas/i)).toBeInTheDocument();
    expect(screen.getByText(/Configurações de Email/i)).toBeInTheDocument();
  });
});
