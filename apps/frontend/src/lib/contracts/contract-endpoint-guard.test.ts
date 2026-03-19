import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveApiRouteContractPolicy } from "@contracts/api-routes";
import { describe, expect, it } from "vitest";

const frontendSrcDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../",
);
const authFragment = "/auth" + "/";
const dashboardFragment = "/system" + "/dashboard";
const allowedFiles = new Set([
  path.resolve(frontendSrcDir, "lib/contracts/auth-client.ts"),
  path.resolve(frontendSrcDir, "lib/contracts/dashboard-client.ts"),
]);

const endpointLiteralPatterns = [
  /api\.(?:get|post|put|patch|delete)\(\s*([`'"])(.*?)\1/gs,
  /\b(?:listEndpoint|statsEndpoint)\s*:\s*([`'"])(.*?)\1/gs,
];

function collectSourceFiles(dir: string): string[] {
  const output: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "core") {
      continue;
    }

    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      output.push(...collectSourceFiles(absolutePath));
      continue;
    }

    if (/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) {
      continue;
    }

    if (/\.(ts|tsx)$/.test(entry.name)) {
      output.push(absolutePath);
    }
  }
  return output;
}

describe("frontend contract endpoint guard", () => {
  it("keeps auth and dashboard endpoints behind the shared contract clients", () => {
    const violations = collectSourceFiles(frontendSrcDir)
      .filter((filePath) => !allowedFiles.has(filePath))
      .flatMap((filePath) => {
        const contents = fs.readFileSync(filePath, "utf8");
        const endpointLiterals = extractEndpointLiterals(contents);
        const matchedPatterns = endpointLiterals.filter(
          (pattern) => pattern.includes(authFragment) || pattern.includes(dashboardFragment),
        );

        return matchedPatterns.map((pattern) => `${path.relative(frontendSrcDir, filePath)} -> ${pattern}`);
      });

    expect(violations).toEqual([]);
  });

  it("maps every active frontend endpoint to a shared api route policy", () => {
    const violations = collectSourceFiles(frontendSrcDir)
      .flatMap((filePath) => {
        const contents = fs.readFileSync(filePath, "utf8");
        const endpoints = extractEndpointLiterals(contents)
          .map(normalizeEndpointLiteral)
          .filter(Boolean);

        return endpoints
          .filter((endpoint) => resolveApiRouteContractPolicy(endpoint).id === "default")
          .map((endpoint) => `${path.relative(frontendSrcDir, filePath)} -> ${endpoint}`);
      });

    expect(violations).toEqual([]);
  });
});

function extractEndpointLiterals(contents: string): string[] {
  const matches: string[] = [];

  for (const pattern of endpointLiteralPatterns) {
    for (const match of contents.matchAll(pattern)) {
      if (match[2]) {
        matches.push(match[2]);
      }
    }
  }

  return matches;
}

function normalizeEndpointLiteral(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) {
    return "";
  }

  const withoutExpressions = trimmed.replace(/\$\{[^}]+\}/g, "*");
  const [pathOnly] = withoutExpressions.split("?");
  return pathOnly;
}
