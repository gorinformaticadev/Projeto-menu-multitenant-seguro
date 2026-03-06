import { describe, expect, it } from "vitest";
import {
  allowedWidgetIdsByRole,
  formatBytes,
  formatDurationSeconds,
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
    expect(allowedWidgetIdsByRole("USER")).not.toContain("redis");
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
});
