import { describe, expect, it } from "vitest";
import {
  buildCronExpressionFromForm,
  createCronEditorForm,
  describeCronSchedule,
  getCronTaskPresentation,
  humanizeCronExpression,
  validateCronExpression,
} from "@/app/configuracoes/sistema/cron/cron-task.utils";

describe("cron-task.utils", () => {
  it("retorna labels amigaveis em portugues para tarefas conhecidas", () => {
    const presentation = getCronTaskPresentation({
      key: "system.job_watchdog_evaluator",
      name: "Job watchdog evaluator",
      description: "Monitora jobs",
    });

    expect(presentation.label).toBe("Monitor de tarefas agendadas");
    expect(presentation.description).toContain("atrasadas");
  });

  it("detecta cron simples de horas e humaniza a lista", () => {
    const reference = new Date(2026, 2, 7, 9, 10, 0);
    const form = createCronEditorForm("0 */6 * * *");
    const summary = describeCronSchedule("0 */6 * * *", reference);

    expect(form.mode).toBe("simple");
    expect(form.preset).toBe("every_hours");
    expect(form.interval).toBe(6);
    expect(summary.label).toBe("A cada 6 horas");
    expect(summary.supportsSimpleMode).toBe(true);
    expect(summary.nextPreviewAt?.getHours()).toBe(12);
    expect(summary.nextPreviewAt?.getMinutes()).toBe(0);
  });

  it("gera cron semanal a partir do modo simplificado", () => {
    const expression = buildCronExpressionFromForm({
      mode: "simple",
      preset: "weekly",
      expression: "",
      interval: 1,
      minute: 30,
      hour: 8,
      weekday: "1",
      dayOfMonth: 1,
    });

    expect(expression).toBe("30 8 * * 1");
    expect(humanizeCronExpression(expression)).toBe("Toda segunda-feira as 08:30");
  });

  it("cai para modo avancado quando a expressao nao pode ser interpretada com seguranca", () => {
    const form = createCronEditorForm("15 10 1,15 * *");
    const summary = describeCronSchedule("15 10 1,15 * *");

    expect(form.mode).toBe("advanced");
    expect(form.preset).toBe("custom");
    expect(summary.label).toBe("Cronograma personalizado");
    expect(summary.supportsSimpleMode).toBe(false);
  });

  it("valida cronograma invalido antes do envio", () => {
    expect(validateCronExpression("99 */2 * * *")).toContain("minuto");
    expect(validateCronExpression("0 2 * * *")).toBeNull();
  });
});
