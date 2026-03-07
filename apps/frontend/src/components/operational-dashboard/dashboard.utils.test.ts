import { describe, expect, it } from "vitest";
import {
  allowedWidgetIdsByRole,
  dashboardGridCols,
  formatBytes,
  formatDurationSeconds,
  isDashboardMobileViewport,
  normalizeLayoutForWidgets,
} from "@/components/operational-dashboard/dashboard.utils";

describe("dashboard.utils", () => {
  it("formats byte values with human readable units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.00 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.00 MB");
  });

  it("formats duration in hh:mm:ss with day prefix when needed", () => {
    expect(formatDurationSeconds(3661)).toBe("01:01:01");
    expect(formatDurationSeconds(90061)).toBe("1d 01:01:01");
  });

  it("returns role specific widget sets", () => {
    expect(allowedWidgetIdsByRole("SUPER_ADMIN")).toContain("redis");
    expect(allowedWidgetIdsByRole("ADMIN")).toEqual(expect.arrayContaining(["routeLatency", "routeErrors"]));
    expect(allowedWidgetIdsByRole("USER")).not.toContain("redis");
    expect(allowedWidgetIdsByRole("USER")).not.toContain("routeLatency");
  });

  it("normalizes layout ensuring all widgets exist", () => {
    const widgets = ["version", "uptime", "api"];
    const normalized = normalizeLayoutForWidgets(
      {
        lg: [{ i: "version", x: 0, y: 0, w: 1, h: 1 }],
      },
      widgets,
    );

    expect(Array.isArray(normalized.lg)).toBe(true);
    expect(normalized.lg).toHaveLength(3);
    expect(normalized.lg.map((item) => item.i)).toEqual(
      expect.arrayContaining(["version", "uptime", "api"]),
    );
  });

  it("uses larger presets for analytic widgets in the default desktop layout", () => {
    const normalized = normalizeLayoutForWidgets({}, ["version", "api"]);
    const apiItem = normalized.lg.find((item) => item.i === "api");

    expect(apiItem).toMatchObject({
      w: 4,
      h: 2,
    });
  });

  it("keeps analytic widgets compact on medium layouts", () => {
    const normalized = normalizeLayoutForWidgets({}, ["version", "api"]);
    const apiItem = normalized.md.find((item) => item.i === "api");

    expect(apiItem).toMatchObject({
      w: 3,
      h: 2,
    });
  });

  it("uses a single column layout on small screens", () => {
    expect(dashboardGridCols.sm).toBe(1);

    const normalized = normalizeLayoutForWidgets({}, ["version", "backup", "errors"]);
    expect(normalized.sm.every((item) => item.w === 1)).toBe(true);
  });

  it("prioritizes critical widgets first on small screens", () => {
    const normalized = normalizeLayoutForWidgets({}, ["version", "backup", "errors"]);
    const orderedIds = [...normalized.sm]
      .sort((left, right) => Number(left.y) - Number(right.y) || Number(left.x) - Number(right.x))
      .map((item) => item.i);

    expect(orderedIds.slice(0, 2)).toEqual(["errors", "backup"]);
  });

  it("flags dashboard editing as mobile-only restriction under 640px", () => {
    expect(isDashboardMobileViewport(375)).toBe(true);
    expect(isDashboardMobileViewport(640)).toBe(false);
    expect(isDashboardMobileViewport(1024)).toBe(false);
  });
});

