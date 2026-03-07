export type CronTaskLike = {
  key: string;
  name: string;
  description: string;
};

export type CronSimplePreset = "every_minutes" | "every_hours" | "daily" | "weekly" | "monthly";
export type CronEditorMode = "simple" | "advanced";

export type CronEditorForm = {
  mode: CronEditorMode;
  preset: CronSimplePreset | "custom";
  expression: string;
  interval: number;
  minute: number;
  hour: number;
  weekday: string;
  dayOfMonth: number;
};

export type CronTaskPresentation = {
  label: string;
  description: string;
};

export type CronScheduleSummary = {
  label: string;
  custom: boolean;
  supportsSimpleMode: boolean;
  nextPreviewAt: Date | null;
};

type ParsedCronFields = {
  raw: string;
  seconds?: string;
  fields: [string, string, string, string, string];
};

const DEFAULT_EDITOR_FORM: CronEditorForm = {
  mode: "advanced",
  preset: "custom",
  expression: "",
  interval: 6,
  minute: 0,
  hour: 2,
  weekday: "1",
  dayOfMonth: 1,
};

const TASK_PRESENTATION_MAP: Record<string, CronTaskPresentation> = {
  "system.update_check": {
    label: "Verificacao de atualizacoes do sistema",
    description: "Verifica periodicamente se ha novas versoes da plataforma disponiveis.",
  },
  "system.log_cleanup": {
    label: "Limpeza de logs de atualizacao",
    description: "Remove historicos antigos de atualizacao para manter a area de operacao enxuta.",
  },
  "system.backup_auto_create": {
    label: "Backup automatico",
    description: "Enfileira backups periodicos do ambiente conforme o cronograma configurado.",
  },
  "system.backup_retention": {
    label: "Retencao de backups",
    description: "Aplica a politica de retencao e remove copias antigas automaticamente.",
  },
  "system.system_data_retention": {
    label: "Limpeza automatica de dados do sistema",
    description: "Limpa audit logs e notificacoes lidas de acordo com a politica de retencao.",
  },
  "system.operational_alerts_evaluator": {
    label: "Monitor de alertas operacionais",
    description: "Avalia a telemetria recente e dispara alertas operacionais quando necessario.",
  },
  "system.token_cleanup": {
    label: "Limpeza de tokens expirados",
    description: "Remove tokens expirados ou antigos para reduzir risco e manter a base enxuta.",
  },
  "system.job_watchdog_evaluator": {
    label: "Monitor de tarefas agendadas",
    description: "Detecta tarefas atrasadas, travadas ou com falhas repetidas e gera alertas.",
  },
};

export const CRON_PRESET_OPTIONS: Array<{ value: CronSimplePreset; label: string }> = [
  { value: "every_minutes", label: "A cada X minutos" },
  { value: "every_hours", label: "A cada X horas" },
  { value: "daily", label: "Todo dia em um horario" },
  { value: "weekly", label: "Toda semana em um dia e horario" },
  { value: "monthly", label: "Todo mes em um dia e horario" },
];

export const CRON_WEEKDAY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "1", label: "Segunda-feira" },
  { value: "2", label: "Terca-feira" },
  { value: "3", label: "Quarta-feira" },
  { value: "4", label: "Quinta-feira" },
  { value: "5", label: "Sexta-feira" },
  { value: "6", label: "Sabado" },
  { value: "0", label: "Domingo" },
];

export function getCronTaskPresentation(task: CronTaskLike): CronTaskPresentation {
  const mapped = TASK_PRESENTATION_MAP[task.key];
  if (mapped) {
    return mapped;
  }

  return {
    label: normalizeFriendlyLabel(task.name || task.key),
    description:
      task.description?.trim() || "Tarefa agendada disponivel para acompanhamento e ajuste.",
  };
}

export function createCronEditorForm(expression: string): CronEditorForm {
  const parsed = parseExpressionToEditorState(expression);
  if (!parsed) {
    return {
      ...DEFAULT_EDITOR_FORM,
      expression: expression.trim(),
    };
  }

  return parsed;
}

export function buildCronExpressionFromForm(form: CronEditorForm): string {
  if (form.mode === "advanced" || form.preset === "custom") {
    return form.expression.trim();
  }

  const minute = clamp(form.minute, 0, 59);
  const hour = clamp(form.hour, 0, 23);
  const interval = clamp(form.interval, 1, 59);
  const dayOfMonth = clamp(form.dayOfMonth, 1, 31);

  switch (form.preset) {
    case "every_minutes":
      return interval <= 1 ? "* * * * *" : `*/${interval} * * * *`;
    case "every_hours":
      return `${minute} ${interval <= 1 ? "*" : `*/${interval}`} * * *`;
    case "daily":
      return `${minute} ${hour} * * *`;
    case "weekly":
      return `${minute} ${hour} * * ${normalizeWeekday(form.weekday)}`;
    case "monthly":
      return `${minute} ${hour} ${dayOfMonth} * *`;
    default:
      return form.expression.trim();
  }
}

export function describeCronSchedule(expression: string, reference = new Date()): CronScheduleSummary {
  const form = createCronEditorForm(expression);
  const finalExpression = buildCronExpressionFromForm(form);
  const supported = form.preset !== "custom";

  return {
    label: humanizeCronExpression(finalExpression),
    custom: !supported,
    supportsSimpleMode: supported,
    nextPreviewAt: supported ? estimateNextRunFromCron(finalExpression, reference) : null,
  };
}

export function humanizeCronExpression(expression: string): string {
  const form = createCronEditorForm(expression);

  if (form.preset === "custom") {
    return "Cronograma personalizado";
  }

  if (form.preset === "every_minutes") {
    return form.interval <= 1 ? "A cada minuto" : `A cada ${form.interval} minutos`;
  }

  if (form.preset === "every_hours") {
    const base = form.interval <= 1 ? "A cada hora" : `A cada ${form.interval} horas`;
    return form.minute === 0 ? base : `${base}, aos ${pad2(form.minute)} min`;
  }

  if (form.preset === "daily") {
    return `Todos os dias as ${pad2(form.hour)}:${pad2(form.minute)}`;
  }

  if (form.preset === "weekly") {
    return `${humanizeWeeklyPrefix(form.weekday)} as ${pad2(form.hour)}:${pad2(form.minute)}`;
  }

  return `Todo dia ${pad2(form.dayOfMonth)} as ${pad2(form.hour)}:${pad2(form.minute)}`;
}

export function validateCronExpression(expression: string): string | null {
  const parsed = parseCronFields(expression);
  if (!parsed) {
    return "Use uma expressao cron com 5 campos (ou 6 campos com segundos).";
  }

  if (parsed.seconds) {
    const secondsError = validateCronField(parsed.seconds, 0, 59, "segundo");
    if (secondsError) {
      return secondsError;
    }
  }

  const [minute, hour, dayOfMonth, month, weekday] = parsed.fields;

  return (
    validateCronField(minute, 0, 59, "minuto") ||
    validateCronField(hour, 0, 23, "hora") ||
    validateCronField(dayOfMonth, 1, 31, "dia do mes") ||
    validateCronField(month, 1, 12, "mes") ||
    validateCronField(weekday, 0, 7, "dia da semana")
  );
}

export function estimateNextRunFromCron(expression: string, reference = new Date()): Date | null {
  const form = createCronEditorForm(expression);

  if (form.preset === "custom") {
    return null;
  }

  if (form.preset === "every_minutes") {
    return estimateNextMinuteRun(form.interval, reference);
  }

  if (form.preset === "every_hours") {
    return estimateNextHourlyRun(form.interval, form.minute, reference);
  }

  if (form.preset === "daily") {
    return estimateNextDailyRun(form.hour, form.minute, reference);
  }

  if (form.preset === "weekly") {
    return estimateNextWeeklyRun(form.weekday, form.hour, form.minute, reference);
  }

  return estimateNextMonthlyRun(form.dayOfMonth, form.hour, form.minute, reference);
}

function parseExpressionToEditorState(expression: string): CronEditorForm | null {
  const parsed = parseCronFields(expression);
  if (!parsed) {
    return null;
  }

  const [minuteField, hourField, dayOfMonthField, monthField, weekdayField] = parsed.fields;
  const minuteStep = parseEveryStep(minuteField);
  const hourStep = parseEveryStep(hourField);
  const minute = parseFixedValue(minuteField);
  const hour = parseFixedValue(hourField);
  const dayOfMonth = parseFixedValue(dayOfMonthField);
  const weekday = parseWeekday(weekdayField);

  if (minuteStep && hourField === "*" && dayOfMonthField === "*" && monthField === "*" && weekdayField === "*") {
    return {
      mode: "simple",
      preset: "every_minutes",
      expression: parsed.raw,
      interval: minuteStep,
      minute: 0,
      hour: 0,
      weekday: "1",
      dayOfMonth: 1,
    };
  }

  if (minute !== null && hourStep && dayOfMonthField === "*" && monthField === "*" && weekdayField === "*") {
    return {
      mode: "simple",
      preset: "every_hours",
      expression: parsed.raw,
      interval: hourStep,
      minute,
      hour: 0,
      weekday: "1",
      dayOfMonth: 1,
    };
  }

  if (minute !== null && hour !== null && dayOfMonthField === "*" && monthField === "*" && weekdayField === "*") {
    return {
      mode: "simple",
      preset: "daily",
      expression: parsed.raw,
      interval: 1,
      minute,
      hour,
      weekday: "1",
      dayOfMonth: 1,
    };
  }

  if (minute !== null && hour !== null && dayOfMonthField === "*" && monthField === "*" && weekday !== null) {
    return {
      mode: "simple",
      preset: "weekly",
      expression: parsed.raw,
      interval: 1,
      minute,
      hour,
      weekday,
      dayOfMonth: 1,
    };
  }

  if (minute !== null && hour !== null && dayOfMonth !== null && monthField === "*" && weekdayField === "*") {
    return {
      mode: "simple",
      preset: "monthly",
      expression: parsed.raw,
      interval: 1,
      minute,
      hour,
      weekday: "1",
      dayOfMonth,
    };
  }

  return {
    ...DEFAULT_EDITOR_FORM,
    expression: parsed.raw,
  };
}

function parseCronFields(expression: string): ParsedCronFields | null {
  const tokens = expression
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 5) {
    return {
      raw: tokens.join(" "),
      seconds: undefined,
      fields: [tokens[0], tokens[1], tokens[2], tokens[3], tokens[4]],
    };
  }

  if (tokens.length === 6) {
    return {
      raw: tokens.join(" "),
      seconds: tokens[0],
      fields: [tokens[1], tokens[2], tokens[3], tokens[4], tokens[5]],
    };
  }

  return null;
}

function validateCronField(field: string, min: number, max: number, label: string): string | null {
  const chunks = field.split(",");

  for (const chunk of chunks) {
    const part = chunk.trim();
    if (!part) {
      return `O campo ${label} contem um valor vazio.`;
    }

    const [base, step] = part.split("/");
    if (part.split("/").length > 2) {
      return `O campo ${label} contem uma divisao invalida.`;
    }

    if (step) {
      const parsedStep = Number.parseInt(step, 10);
      if (!Number.isInteger(parsedStep) || parsedStep <= 0) {
        return `O campo ${label} precisa usar um intervalo valido.`;
      }
    }

    if (base === "*") {
      continue;
    }

    if (base.includes("-")) {
      const [startRaw, endRaw] = base.split("-");
      const start = Number.parseInt(startRaw, 10);
      const end = Number.parseInt(endRaw, 10);

      if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end) {
        return `O campo ${label} contem um intervalo fora do permitido.`;
      }

      continue;
    }

    const value = Number.parseInt(base, 10);
    if (!Number.isInteger(value) || value < min || value > max) {
      return `O campo ${label} precisa ficar entre ${min} e ${max}.`;
    }
  }

  return null;
}

function parseEveryStep(field: string): number | null {
  if (field === "*") {
    return 1;
  }

  if (field.startsWith("*/")) {
    return safePositiveInt(field.slice(2));
  }

  if (field.startsWith("0/")) {
    return safePositiveInt(field.slice(2));
  }

  if (field.startsWith("0-59/")) {
    return safePositiveInt(field.slice(5));
  }

  if (field.startsWith("0-23/")) {
    return safePositiveInt(field.slice(5));
  }

  return null;
}

function parseFixedValue(field: string): number | null {
  if (!/^\d+$/.test(field)) {
    return null;
  }

  const value = Number.parseInt(field, 10);
  return Number.isInteger(value) ? value : null;
}

function parseWeekday(field: string): string | null {
  const fixed = parseFixedValue(field);
  if (fixed === null) {
    return null;
  }

  return normalizeWeekday(String(fixed));
}

function safePositiveInt(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function estimateNextMinuteRun(interval: number, reference: Date): Date {
  const safeInterval = clamp(interval, 1, 59);
  const candidate = new Date(reference);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  while (candidate.getMinutes() % safeInterval !== 0) {
    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  return candidate;
}

function estimateNextHourlyRun(interval: number, minute: number, reference: Date): Date {
  const safeInterval = clamp(interval, 1, 23);
  const safeMinute = clamp(minute, 0, 59);
  const candidate = new Date(reference);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(safeMinute, 0, 0);

  if (candidate <= reference) {
    candidate.setHours(candidate.getHours() + 1);
    candidate.setMinutes(safeMinute, 0, 0);
  }

  for (let index = 0; index < 48; index += 1) {
    if (safeInterval === 1 || candidate.getHours() % safeInterval === 0) {
      return candidate;
    }
    candidate.setHours(candidate.getHours() + 1);
    candidate.setMinutes(safeMinute, 0, 0);
  }

  return candidate;
}

function estimateNextDailyRun(hour: number, minute: number, reference: Date): Date {
  const candidate = new Date(reference);
  candidate.setHours(clamp(hour, 0, 23), clamp(minute, 0, 59), 0, 0);

  if (candidate <= reference) {
    candidate.setDate(candidate.getDate() + 1);
  }

  return candidate;
}

function estimateNextWeeklyRun(weekday: string, hour: number, minute: number, reference: Date): Date {
  const targetDay = Number.parseInt(normalizeWeekday(weekday), 10);

  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(reference);
    candidate.setHours(clamp(hour, 0, 23), clamp(minute, 0, 59), 0, 0);
    candidate.setDate(candidate.getDate() + offset);
    if (candidate.getDay() === targetDay && candidate > reference) {
      return candidate;
    }
  }

  const fallback = new Date(reference);
  fallback.setDate(fallback.getDate() + 7);
  fallback.setHours(clamp(hour, 0, 23), clamp(minute, 0, 59), 0, 0);
  return fallback;
}

function estimateNextMonthlyRun(dayOfMonth: number, hour: number, minute: number, reference: Date): Date | null {
  const safeDay = clamp(dayOfMonth, 1, 31);

  for (let offset = 0; offset < 24; offset += 1) {
    const base = new Date(reference.getFullYear(), reference.getMonth() + offset, 1);
    const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    if (safeDay > daysInMonth) {
      continue;
    }

    const candidate = new Date(
      base.getFullYear(),
      base.getMonth(),
      safeDay,
      clamp(hour, 0, 23),
      clamp(minute, 0, 59),
      0,
      0,
    );

    if (candidate > reference) {
      return candidate;
    }
  }

  return null;
}

function normalizeFriendlyLabel(value: string): string {
  return value
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => capitalize(part))
    .join(" ");
}

function weekdayLabel(weekday: string): string {
  return CRON_WEEKDAY_OPTIONS.find((option) => option.value === normalizeWeekday(weekday))?.label || "Dia invalido";
}

function humanizeWeeklyPrefix(weekday: string): string {
  const normalized = normalizeWeekday(weekday);
  const label = weekdayLabel(normalized).toLowerCase();

  if (normalized === "0" || normalized === "6") {
    return `Todo ${label}`;
  }

  return `Toda ${label}`;
}

function normalizeWeekday(weekday: string): string {
  const parsed = Number.parseInt(weekday, 10);
  if (!Number.isInteger(parsed)) {
    return "0";
  }

  return String(parsed === 7 ? 0 : clamp(parsed, 0, 6));
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function pad2(value: number): string {
  return String(clamp(value, 0, 99)).padStart(2, "0");
}

function capitalize(value: string): string {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
