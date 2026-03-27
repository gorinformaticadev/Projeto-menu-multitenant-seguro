import { describe, expect, it } from "vitest";
import { getAllowedModuleActions, getDisabledTooltip, type InstalledModule } from "@/lib/module-utils";

const createModule = (overrides: Partial<InstalledModule> = {}): InstalledModule => ({
  slug: "ordem_servico",
  name: "Ordem de Servico",
  version: "3.1.0",
  description: "Modulo de teste",
  status: "installed",
  hasBackend: true,
  hasFrontend: true,
  installedAt: "2026-03-09T12:00:00.000Z",
  activatedAt: null,
  lifecycle: {
    current: "files_installed",
    blockers: [],
    dependencies: [],
    npmDependencies: {
      backend: [],
      frontend: [],
      total: 0,
      pending: 0,
      installed: 0,
      conflicts: 0,
    },
    frontendInspectMode: "filesystem",
    frontendValidationLevel: "structural",
    steps: {
      files: { status: "ready", detail: "Arquivos validados." },
      database: { status: "pending", detail: "Banco pendente." },
      dependencies: { status: "ready", detail: "Dependencias prontas." },
      build: { status: "ready", detail: "Validacao estrutural: paginas encontradas." },
      approval: { status: "blocked", detail: "Banco pendente." },
      activation: { status: "blocked", detail: "Banco pendente." },
    },
  },
  ...overrides,
});

describe("module-utils lifecycle action gating", () => {
  it("permite preparar banco somente quando lifecycle indica arquivos e dependencias prontas", () => {
    const moduleItem = createModule();

    expect(getAllowedModuleActions(moduleItem)).toMatchObject({
      updateDatabase: true,
      activate: false,
      deactivate: false,
    });
  });

  it("bloqueia preparar banco quando dependencias estao bloqueadas e usa o motivo do lifecycle", () => {
    const moduleItem = createModule({
      lifecycle: {
        ...createModule().lifecycle!,
        blockers: ["Dependencia base_module desativada."],
        steps: {
          ...createModule().lifecycle!.steps,
          dependencies: {
            status: "blocked",
            detail: "Dependencia base_module desativada.",
          },
        },
      },
    });

    expect(getAllowedModuleActions(moduleItem).updateDatabase).toBe(false);
    expect(getDisabledTooltip("updateDatabase", moduleItem)).toBe("Dependencia base_module desativada.");
  });

  it("bloqueia ativacao quando o build do frontend esta bloqueado", () => {
    const moduleItem = createModule({
      status: "db_ready",
      lifecycle: {
        ...createModule().lifecycle!,
        current: "db_ready",
        blockers: ["Frontend nao pronto."],
        steps: {
          ...createModule().lifecycle!.steps,
          database: { status: "ready", detail: "Banco preparado." },
          build: { status: "blocked", detail: "Frontend nao pronto." },
          approval: { status: "blocked", detail: "Frontend nao pronto." },
          activation: { status: "blocked", detail: "Frontend nao pronto." },
        },
      },
    });

    expect(getAllowedModuleActions(moduleItem).activate).toBe(false);
    expect(getDisabledTooltip("activate", moduleItem)).toBe("Frontend nao pronto.");
  });

  it("permite ativacao quando todas as etapas exigidas estao prontas", () => {
    const moduleItem = createModule({
      status: "db_ready",
      lifecycle: {
        ...createModule().lifecycle!,
        current: "approved",
        blockers: [],
        steps: {
          ...createModule().lifecycle!.steps,
          database: { status: "ready", detail: "Banco preparado." },
          approval: { status: "ready", detail: "Modulo pronto para aprovacao." },
          activation: { status: "pending", detail: "Modulo pronto para ativacao." },
        },
      },
    });

    expect(getAllowedModuleActions(moduleItem)).toMatchObject({
      updateDatabase: false,
      activate: true,
      deactivate: false,
    });
  });
});
