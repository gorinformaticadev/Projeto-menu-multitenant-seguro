import { describe, expect, it } from "vitest";
import { API_CURRENT_VERSION, API_VERSION_HEADER } from "@contracts/http";
import api, { API_JSON_HEADERS, buildApiRequestHeaders } from "@/lib/api";

describe("api contract version headers", () => {
  it("sets the current api version on the shared axios client", () => {
    expect(API_JSON_HEADERS[API_VERSION_HEADER]).toBe(API_CURRENT_VERSION);
    expect(api.defaults.headers.common[API_VERSION_HEADER]).toBe(API_CURRENT_VERSION);
  });

  it("preserves the contract version when building raw auth headers", () => {
    expect(buildApiRequestHeaders()).toEqual(
      expect.objectContaining({
        "Content-Type": "application/json",
        [API_VERSION_HEADER]: API_CURRENT_VERSION,
      }),
    );
  });
});
