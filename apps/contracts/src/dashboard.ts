import { z } from "zod";
import { roleSchema } from "./auth";
import type { ApiVersion } from "./http";

const dashboardLayoutBreakpointSchema = z.enum(["lg", "md", "sm"]);
const isoDateTimeSchema = z.string().datetime();
const nonEmptyTrimmedString = z.string().trim().min(1);
const nonNegativeIntegerSchema = z.number().int().min(0);
const boundedNumberSchema = z.number().finite();
const nonNegativeNumberSchema = z.number().min(0).finite();

export const DASHBOARD_LAYOUT_MAX_WIDGETS_PER_BREAKPOINT = 48;
export const DASHBOARD_MAX_HIDDEN_WIDGET_IDS = 64;
export const DASHBOARD_MAX_ROUTE_POINTS = 24;
export const DASHBOARD_MAX_ROUTE_TOP_ITEMS = 10;
export const DASHBOARD_MAX_RECENT_ERRORS = 20;
export const DASHBOARD_MAX_RECENT_FAILURES = 20;
export const DASHBOARD_MAX_RECENT_BACKUPS = 10;
export const DASHBOARD_MAX_NOTIFICATION_ALERTS = 10;
export const DASHBOARD_MAX_WIDGET_IDS = 64;
export const DASHBOARD_MAX_MODULE_CARD_STATS = 6;
export const DASHBOARD_MAX_MODULE_CARD_ITEMS = 12;

export const systemDashboardSeveritySchema = z.enum(["all", "info", "warning", "critical"]);
export type SystemDashboardSeverity = z.infer<typeof systemDashboardSeveritySchema>;

export const dashboardPaths = {
  aggregate: "/system/dashboard",
  moduleCards: "/system/dashboard/module-cards",
  layout: "/system/dashboard/layout",
} as const;

const dashboardLayoutItemSchema = z
  .object({
    i: nonEmptyTrimmedString,
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    w: z.number().int().min(1),
    h: z.number().int().min(1),
    minW: z.number().int().min(0).optional(),
    maxW: z.number().int().min(1).optional(),
    minH: z.number().int().min(0).optional(),
    maxH: z.number().int().min(1).optional(),
    moved: z.boolean().optional(),
    static: z.boolean().optional(),
  })
  .strict();

export const dashboardLayoutJsonSchema = z.record(
  dashboardLayoutBreakpointSchema,
  z.array(dashboardLayoutItemSchema).max(DASHBOARD_LAYOUT_MAX_WIDGETS_PER_BREAKPOINT),
);

export type DashboardLayoutJson = z.infer<typeof dashboardLayoutJsonSchema>;

export const systemDashboardQuerySchema = z
  .object({
    periodMinutes: z.coerce.number().int().min(5).max(24 * 60).optional(),
    tenantId: z.string().trim().min(1).optional(),
    severity: systemDashboardSeveritySchema.optional(),
  })
  .strict();

export type SystemDashboardQuery = z.infer<typeof systemDashboardQuerySchema>;

export const dashboardStoredFiltersSchema = z
  .object({
    periodMinutes: z.number().int().min(5).max(24 * 60).optional(),
    tenantId: z.string().trim().min(1).nullable().optional(),
    severity: systemDashboardSeveritySchema.optional(),
    operationalPinned: z.boolean().optional(),
    hiddenWidgetIds: z
      .array(nonEmptyTrimmedString)
      .max(DASHBOARD_MAX_HIDDEN_WIDGET_IDS)
      .optional(),
  })
  .strict();

export type DashboardStoredFilters = z.infer<typeof dashboardStoredFiltersSchema>;

export const updateSystemDashboardLayoutBodySchema = z
  .object({
    layoutJson: dashboardLayoutJsonSchema.optional(),
    filtersJson: dashboardStoredFiltersSchema.optional(),
  })
  .strict();

export type UpdateSystemDashboardLayoutBody = z.infer<
  typeof updateSystemDashboardLayoutBodySchema
>;

export const dashboardLayoutResolutionSchema = z
  .object({
    source: z.enum(["user_role", "role_default"]).optional(),
    key: z
      .object({
        userId: nonEmptyTrimmedString,
        role: roleSchema,
      })
      .strict()
      .optional(),
    precedence: z.array(z.enum(["user_role", "role_default"])).max(2).optional(),
    description: z.string().trim().min(1).optional(),
  })
  .strict();

export const dashboardLayoutResponseSchema = z
  .object({
    role: roleSchema.optional(),
    layoutJson: dashboardLayoutJsonSchema.optional(),
    filtersJson: dashboardStoredFiltersSchema.nullable().optional(),
    updatedAt: z.string().datetime().nullable().optional(),
    resolution: dashboardLayoutResolutionSchema.nullable().optional(),
  })
  .strict();

export type DashboardLayoutResponse = z.infer<typeof dashboardLayoutResponseSchema>;

const dashboardModuleCardStatSchema = z
  .object({
    label: nonEmptyTrimmedString,
    value: z.string(),
  })
  .strict();

const dashboardModuleCardItemSchema = z
  .object({
    id: nonEmptyTrimmedString,
    label: nonEmptyTrimmedString,
    value: z.string().optional(),
    column: nonEmptyTrimmedString.optional(),
    tone: z.enum(["neutral", "good", "warn", "danger"]).optional(),
  })
  .strict();

export const dashboardModuleCardSchema = z
  .object({
    id: nonEmptyTrimmedString,
    title: nonEmptyTrimmedString,
    description: z.string().nullable().optional(),
    module: nonEmptyTrimmedString,
    visibilityRole: roleSchema.optional(),
    kind: z.enum(["summary", "list", "kanban"]).optional(),
    icon: z.string().nullable().optional(),
    href: z.string().nullable().optional(),
    actionLabel: z.string().nullable().optional(),
    size: z.enum(["small", "medium", "large"]).optional(),
    stats: z.array(dashboardModuleCardStatSchema).max(DASHBOARD_MAX_MODULE_CARD_STATS).optional(),
    items: z.array(dashboardModuleCardItemSchema).max(DASHBOARD_MAX_MODULE_CARD_ITEMS).optional(),
  })
  .strict();

export type DashboardModuleCard = z.infer<typeof dashboardModuleCardSchema>;

export const dashboardModuleCardsResponseSchema = z
  .object({
    generatedAt: isoDateTimeSchema.optional(),
    cards: z.array(dashboardModuleCardSchema),
    widgets: z
      .object({
        available: z.array(nonEmptyTrimmedString).max(DASHBOARD_MAX_WIDGET_IDS),
      })
      .strict(),
  })
  .strict();

export type DashboardModuleCardsResponse = z.infer<typeof dashboardModuleCardsResponseSchema>;

const metricFallbackSchema = z
  .object({
    status: z.enum(["error", "degraded", "unavailable"]),
    error: nonEmptyTrimmedString,
  })
  .strict();

const restrictedMetricSchema = z
  .object({
    status: z.literal("restricted"),
  })
  .strict();

const dashboardHistoryPointSchema = z
  .object({
    at: isoDateTimeSchema,
    value: boundedNumberSchema.nullable(),
    sampleSize: nonNegativeIntegerSchema.optional(),
    rssBytes: nonNegativeIntegerSchema.optional(),
    heapUsedBytes: nonNegativeIntegerSchema.optional(),
  })
  .strict();

const dashboardRouteSummarySchema = z
  .object({
    route: nonEmptyTrimmedString,
    method: nonEmptyTrimmedString,
    requestCount: nonNegativeIntegerSchema,
    avgMs: boundedNumberSchema.nullable(),
    p95Ms: boundedNumberSchema.nullable(),
    errorCount: nonNegativeIntegerSchema,
    errorRate: boundedNumberSchema,
    status2xx: nonNegativeIntegerSchema,
    status4xx: nonNegativeIntegerSchema,
    status5xx: nonNegativeIntegerSchema,
    lastErrorAt: isoDateTimeSchema.nullable(),
  })
  .strict();

const dashboardSecurityIpSummarySchema = z
  .object({
    ip: nonEmptyTrimmedString,
    count: nonNegativeIntegerSchema,
    lastSeenAt: isoDateTimeSchema,
    route: z.string().trim().min(1).nullable(),
  })
  .strict();

const dashboardSecurityRecentEventSchema = z
  .object({
    type: z.enum([
      "unauthorized",
      "forbidden",
      "rate_limited",
      "maintenance_blocked",
      "maintenance_bypass_attempt",
    ]),
    statusCode: z.number().int().min(100).max(599),
    method: nonEmptyTrimmedString,
    route: nonEmptyTrimmedString,
    ip: nonEmptyTrimmedString,
    at: isoDateTimeSchema,
  })
  .strict();

const dashboardBackupSummarySchema = z
  .object({
    id: nonEmptyTrimmedString,
    artifactId: z.string().trim().min(1).nullable(),
    fileName: z.string().trim().min(1).nullable(),
    status: nonEmptyTrimmedString,
    sizeBytes: nonNegativeIntegerSchema.nullable(),
    startedAt: isoDateTimeSchema.nullable(),
    finishedAt: isoDateTimeSchema.nullable(),
    durationSeconds: nonNegativeIntegerSchema.nullable(),
  })
  .strict();

const dashboardJobFailureSummarySchema = z
  .object({
    id: nonEmptyTrimmedString,
    type: nonEmptyTrimmedString,
    finishedAt: isoDateTimeSchema.nullable(),
    error: z.string(),
  })
  .strict();

const dashboardAuditEntrySchema = z
  .object({
    id: nonEmptyTrimmedString,
    action: nonEmptyTrimmedString,
    actionLabel: nonEmptyTrimmedString,
    message: z.string(),
    createdAt: isoDateTimeSchema,
  })
  .strict();

const dashboardNotificationAlertSchemaV1 = z
  .object({
    id: nonEmptyTrimmedString,
    title: nonEmptyTrimmedString,
    body: z.string(),
    severity: nonEmptyTrimmedString,
    createdAt: isoDateTimeSchema,
  })
  .strict();

const dashboardNotificationAlertSchemaV2 = z
  .object({
    id: nonEmptyTrimmedString,
    title: nonEmptyTrimmedString,
    body: z.string(),
    severity: nonEmptyTrimmedString,
    createdAt: isoDateTimeSchema,
    action: z.string().trim().min(1).nullable(),
  })
  .strict();

const versionMetricSchema = z.union([
  z
    .object({
      status: z.literal("ok"),
      version: nonEmptyTrimmedString,
      commitSha: z.string().trim().min(1).nullable(),
      buildDate: z.string().trim().min(1).nullable(),
      branch: z.string().trim().min(1).nullable(),
      source: nonEmptyTrimmedString,
    })
    .strict(),
  metricFallbackSchema,
]);

const uptimeMetricSchema = z.union([
  z
    .object({
      status: z.literal("ok"),
      seconds: nonNegativeIntegerSchema,
      human: nonEmptyTrimmedString,
      startedAt: isoDateTimeSchema,
    })
    .strict(),
  metricFallbackSchema,
]);

const maintenanceMetricSchema = z.union([
  z
    .object({
      status: z.literal("ok"),
      enabled: z.boolean(),
      reason: z.string().trim().min(1).nullable(),
      etaSeconds: nonNegativeIntegerSchema.nullable(),
      startedAt: z.string().trim().min(1).nullable(),
    })
    .strict(),
  metricFallbackSchema,
]);

const systemMetricSchema = z.union([
  z
    .object({
      status: z.literal("ok"),
      platform: nonEmptyTrimmedString,
      release: nonEmptyTrimmedString,
      arch: nonEmptyTrimmedString,
      nodeVersion: nonEmptyTrimmedString,
      pid: nonNegativeIntegerSchema.optional(),
    })
    .strict(),
  metricFallbackSchema,
  restrictedMetricSchema,
]);

const cpuMetricSchema = z.union([
  z
    .object({
      status: z.literal("ok"),
      cores: z.number().int().min(1),
      loadAvg: z.tuple([boundedNumberSchema, boundedNumberSchema, boundedNumberSchema]),
      usagePercent: boundedNumberSchema.nullable(),
      eventLoop: z
        .object({
          eventLoopLagP95Ms: boundedNumberSchema,
          eventLoopLagP99Ms: boundedNumberSchema,
          eventLoopLagMaxMs: boundedNumberSchema,
          eventLoopUtilization: z.number().min(0).max(1),
          heapUsedRatio: z.number().min(0).max(1),
          recentApiLatencyMs: boundedNumberSchema.nullable(),
          gcPauseP95Ms: boundedNumberSchema,
          gcPauseMaxMs: boundedNumberSchema,
          gcEventsRecent: nonNegativeIntegerSchema,
          queueDepth: nonNegativeIntegerSchema,
          activeIsolatedRequests: nonNegativeIntegerSchema,
          pressureScore: boundedNumberSchema,
          consecutiveBreaches: nonNegativeIntegerSchema,
          adaptiveThrottleFactor: z.number().min(0).max(1),
          cause: z.enum(["normal", "cpu", "gc", "io", "mixed"]),
          overloaded: z.boolean(),
        })
        .strict()
        .optional(),
    })
    .strict(),
  metricFallbackSchema,
  restrictedMetricSchema,
]);

const memoryMetricSchema = z.union([
  z
    .object({
      status: z.literal("ok"),
      totalBytes: nonNegativeIntegerSchema,
      freeBytes: nonNegativeIntegerSchema,
      usedBytes: nonNegativeIntegerSchema,
      usedPercent: boundedNumberSchema.nullable(),
      process: z
        .object({
          rssBytes: nonNegativeIntegerSchema,
          heapTotalBytes: nonNegativeIntegerSchema,
          heapUsedBytes: nonNegativeIntegerSchema,
          externalBytes: nonNegativeIntegerSchema,
        })
        .strict(),
      history: z.array(dashboardHistoryPointSchema).max(DASHBOARD_MAX_ROUTE_POINTS),
    })
    .strict(),
  metricFallbackSchema,
  restrictedMetricSchema,
]);

const diskMetricSchema = z.union([
  z
    .object({
      status: z.literal("ok"),
      path: nonEmptyTrimmedString,
      totalBytes: nonNegativeIntegerSchema,
      usedBytes: nonNegativeIntegerSchema,
      freeBytes: nonNegativeIntegerSchema,
      usedPercent: boundedNumberSchema.nullable(),
    })
    .strict(),
  metricFallbackSchema,
  restrictedMetricSchema,
]);

const databaseMetricSchema = z.union([
  z
    .object({
      status: z.literal("healthy"),
      latencyMs: nonNegativeIntegerSchema,
    })
    .strict(),
  metricFallbackSchema,
  restrictedMetricSchema,
]);

const redisMetricSchema = z.union([
  z
    .object({
      status: z.enum(["healthy", "degraded", "down"]),
      latencyMs: nonNegativeIntegerSchema.nullable(),
    })
    .strict(),
  z
    .object({
      status: z.literal("not_configured"),
      latencyMs: z.null(),
    })
    .strict(),
  metricFallbackSchema,
  restrictedMetricSchema,
]);

const workersMetricSchema = z.union([
  z
    .object({
      status: z.literal("ok"),
      activeWorkers: nonNegativeIntegerSchema,
      runningJobs: nonNegativeIntegerSchema,
      pendingJobs: nonNegativeIntegerSchema,
    })
    .strict(),
  metricFallbackSchema,
  restrictedMetricSchema,
]);

const apiMetricSchema = z.union([
  z
    .object({
      status: z.literal("ok"),
      avgResponseTimeMs: boundedNumberSchema.nullable(),
      sampleSize: nonNegativeIntegerSchema,
      windowSeconds: nonNegativeIntegerSchema,
      historyWindowSeconds: nonNegativeIntegerSchema,
      scope: z.literal("business"),
      byCategory: z
        .object({
          business: z
            .object({
              averageMs: boundedNumberSchema.nullable(),
              sampleSize: nonNegativeIntegerSchema,
            })
            .strict(),
          system: z
            .object({
              averageMs: boundedNumberSchema.nullable(),
              sampleSize: nonNegativeIntegerSchema,
            })
            .strict(),
          health: z
            .object({
              averageMs: boundedNumberSchema.nullable(),
              sampleSize: nonNegativeIntegerSchema,
            })
            .strict(),
      })
        .strict(),
      history: z.array(dashboardHistoryPointSchema).max(DASHBOARD_MAX_ROUTE_POINTS),
      runtimePressureEventsRecent: nonNegativeIntegerSchema.optional(),
      versionFallbacksRecent: nonNegativeIntegerSchema.optional(),
      requestRetriesRecent: nonNegativeIntegerSchema.optional(),
      requestQueuedRecent: nonNegativeIntegerSchema.optional(),
      requestQueueRejectedRecent: nonNegativeIntegerSchema.optional(),
      requestQueueTimeoutsRecent: nonNegativeIntegerSchema.optional(),
      requestTimeoutsRecent: nonNegativeIntegerSchema.optional(),
      responseOverflowsRecent: nonNegativeIntegerSchema.optional(),
      circuitOpenEventsRecent: nonNegativeIntegerSchema.optional(),
    })
    .strict(),
  metricFallbackSchema,
]);

const routeLatencyMetricSchema = z.union([
  z
    .object({
      status: z.literal("ok"),
      windowStart: isoDateTimeSchema,
      windowSeconds: nonNegativeIntegerSchema,
      totalRequestsRecent: nonNegativeIntegerSchema,
      avgResponseMs: boundedNumberSchema.nullable(),
      errorRateRecent: boundedNumberSchema,
      topSlowRoutes: z.array(dashboardRouteSummarySchema).max(DASHBOARD_MAX_ROUTE_TOP_ITEMS),
      tenantScopeApplied: z.boolean(),
    })
    .strict(),
  metricFallbackSchema,
  restrictedMetricSchema,
]);

const routeErrorsMetricSchema = z.union([
  z
    .object({
      status: z.literal("ok"),
      windowStart: isoDateTimeSchema,
      windowSeconds: nonNegativeIntegerSchema,
      totalRequestsRecent: nonNegativeIntegerSchema,
      totalErrorCount: nonNegativeIntegerSchema,
      errorRateRecent: boundedNumberSchema,
      topErrorRoutes: z.array(dashboardRouteSummarySchema).max(DASHBOARD_MAX_ROUTE_TOP_ITEMS),
      tenantScopeApplied: z.boolean(),
    })
    .strict(),
  metricFallbackSchema,
  restrictedMetricSchema,
]);

const securityMetricSchema = z.union([
  z
    .object({
      status: z.literal("ok"),
      deniedAccess: z.array(dashboardSecurityIpSummarySchema).max(DASHBOARD_MAX_ROUTE_TOP_ITEMS).optional(),
      topDeniedIps: z.array(dashboardSecurityIpSummarySchema).max(DASHBOARD_MAX_ROUTE_TOP_ITEMS).optional(),
      topRateLimitedIps: z
        .array(dashboardSecurityIpSummarySchema)
        .max(DASHBOARD_MAX_ROUTE_TOP_ITEMS)
        .optional(),
      maintenanceBypassAttemptsRecent: nonNegativeIntegerSchema.optional(),
      accessDeniedRecent: z
        .array(dashboardSecurityRecentEventSchema)
        .max(DASHBOARD_MAX_RECENT_ERRORS)
        .optional(),
      routeDistribution: z
        .array(
          z
            .object({
              route: nonEmptyTrimmedString,
              count: nonNegativeIntegerSchema,
            })
            .strict(),
        )
        .max(DASHBOARD_MAX_ROUTE_TOP_ITEMS)
        .optional(),
      windowStart: isoDateTimeSchema.optional(),
      windowSeconds: nonNegativeIntegerSchema.optional(),
      tenantScopeApplied: z.boolean().optional(),
      unauthorizedCountRecent: nonNegativeIntegerSchema.optional(),
      forbiddenCountRecent: nonNegativeIntegerSchema.optional(),
      rateLimitedCountRecent: nonNegativeIntegerSchema.optional(),
      deniedSpikeCountRecent: nonNegativeIntegerSchema.optional(),
    })
    .strict(),
  metricFallbackSchema,
  restrictedMetricSchema,
]);

const backupMetricSchema = z.union([
  z
    .object({
      status: z.literal("ok"),
      lastBackup: dashboardBackupSummarySchema.nullable(),
      recentBackups: z.array(dashboardBackupSummarySchema).max(DASHBOARD_MAX_RECENT_BACKUPS),
    })
    .strict(),
  metricFallbackSchema,
  restrictedMetricSchema,
]);

const jobsMetricSchema = z.union([
  z
    .object({
      status: z.literal("ok"),
      running: nonNegativeIntegerSchema,
      pending: nonNegativeIntegerSchema,
      failedLast24h: nonNegativeIntegerSchema,
      lastFailure: dashboardJobFailureSummarySchema.nullable(),
      recentFailures: z.array(dashboardJobFailureSummarySchema).max(DASHBOARD_MAX_RECENT_FAILURES),
    })
    .strict(),
  metricFallbackSchema,
  restrictedMetricSchema,
]);

const recentErrorsMetricSchema = z.union([
  z
    .object({
      status: z.literal("ok"),
      recent: z.array(dashboardAuditEntrySchema).max(DASHBOARD_MAX_RECENT_ERRORS),
    })
    .strict(),
  metricFallbackSchema,
  restrictedMetricSchema,
]);

const tenantsMetricSchema = z.union([
  z
    .object({
      status: z.literal("ok"),
      active: nonNegativeIntegerSchema,
      total: nonNegativeIntegerSchema,
    })
    .strict(),
  metricFallbackSchema,
  restrictedMetricSchema,
]);

const notificationsMetricSchemaV1 = z.union([
  z
    .object({
      status: z.literal("ok"),
      criticalUnread: nonNegativeIntegerSchema,
      criticalRecent: nonNegativeIntegerSchema,
      operationalRecentCount: nonNegativeIntegerSchema,
      recentOperationalAlerts: z
        .array(dashboardNotificationAlertSchemaV1)
        .max(DASHBOARD_MAX_NOTIFICATION_ALERTS),
    })
    .strict(),
  metricFallbackSchema,
]);

const notificationsMetricSchemaV2 = z.union([
  z
    .object({
      status: z.literal("ok"),
      criticalUnread: nonNegativeIntegerSchema,
      criticalRecent: nonNegativeIntegerSchema,
      operationalRecentCount: nonNegativeIntegerSchema,
      recentOperationalAlerts: z
        .array(dashboardNotificationAlertSchemaV2)
        .max(DASHBOARD_MAX_NOTIFICATION_ALERTS),
    })
    .strict(),
  metricFallbackSchema,
]);

const runtimeMitigationMetricSchema = z
  .object({
    adaptiveThrottleFactor: z.number().min(0.35).max(1),
    pressureCause: z.enum(["normal", "cpu", "gc", "io", "mixed", "cluster"]),
    instanceCount: nonNegativeIntegerSchema,
    overloadedInstances: nonNegativeIntegerSchema,
    clusterRecentApiLatencyMs: nonNegativeNumberSchema.nullable(),
    clusterQueueDepth: nonNegativeIntegerSchema,
    degradeHeavyFeatures: z.boolean(),
    disableRemoteUpdateChecks: z.boolean(),
    rejectHeavyMutations: z.boolean(),
  })
  .strict();

const systemDashboardBaseResponseShape = {
  generatedAt: isoDateTimeSchema,
  responseTimeMs: nonNegativeIntegerSchema,
  filtersApplied: z
    .object({
      periodMinutes: z.number().int().min(5).max(24 * 60),
      tenantId: z.string().trim().min(1).nullable(),
      severity: systemDashboardSeveritySchema,
    })
    .strict(),
  version: versionMetricSchema,
  uptime: uptimeMetricSchema,
  maintenance: maintenanceMetricSchema,
  system: systemMetricSchema,
  cpu: cpuMetricSchema,
  memory: memoryMetricSchema,
  disk: diskMetricSchema,
  database: databaseMetricSchema,
  redis: redisMetricSchema,
  workers: workersMetricSchema,
  api: apiMetricSchema,
  routeLatency: routeLatencyMetricSchema,
  routeErrors: routeErrorsMetricSchema,
  security: securityMetricSchema,
  backup: backupMetricSchema,
  jobs: jobsMetricSchema,
  errors: recentErrorsMetricSchema,
  tenants: tenantsMetricSchema,
  runtimeMitigation: runtimeMitigationMetricSchema,
  widgets: z
    .object({
      available: z.array(nonEmptyTrimmedString).max(DASHBOARD_MAX_WIDGET_IDS),
    })
    .strict(),
} as const;

export const systemDashboardResponseSchemaV1 = z
  .object({
    ...systemDashboardBaseResponseShape,
    notifications: notificationsMetricSchemaV1,
  })
  .strict();

export const systemDashboardResponseSchemaV2 = z
  .object({
    ...systemDashboardBaseResponseShape,
    notifications: notificationsMetricSchemaV2,
  })
  .strict();

export const systemDashboardResponseSchema = systemDashboardResponseSchemaV2;
export const systemDashboardResponseSchemasByVersion = {
  "1": systemDashboardResponseSchemaV1,
  "2": systemDashboardResponseSchemaV2,
} satisfies Record<ApiVersion, z.ZodTypeAny>;

export type SystemDashboardResponse = z.infer<typeof systemDashboardResponseSchema>;
