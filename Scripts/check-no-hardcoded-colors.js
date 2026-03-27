#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const TARGET_DIR = path.join(ROOT_DIR, "apps", "frontend", "src");
const IGNORED_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  "out",
]);
const TEXT_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".mjs",
  ".cjs",
]);
const ALLOWED_FINDINGS = [
  {
    file: "apps/frontend/src/app/modules/[...slug]/DynamicModulePageClient.tsx",
    rule: "Tailwind direct color",
    value: "text-gray-600",
  },
  {
    file: "apps/frontend/src/app/modules/[...slug]/module-exemplo-settings.tsx",
    rule: "Tailwind direct color",
    value: "text-gray-900",
  },
  {
    file: "apps/frontend/src/app/modules/[...slug]/module-exemplo-settings.tsx",
    rule: "Tailwind direct color",
    value: "text-gray-600",
  },
  {
    file: "apps/frontend/src/app/modules/[...slug]/module-exemplo-settings.tsx",
    rule: "Tailwind direct color",
    value: "bg-blue-50",
  },
  {
    file: "apps/frontend/src/app/modules/[...slug]/module-exemplo-settings.tsx",
    rule: "Tailwind direct color",
    value: "text-blue-700",
  },
  {
    file: "apps/frontend/src/app/modules/[...slug]/module-exemplo-settings.tsx",
    rule: "Tailwind direct color",
    value: "border-blue-200",
  },
  {
    file: "apps/frontend/src/app/modules/[...slug]/module-exemplo-settings.tsx",
    rule: "Tailwind direct color",
    value: "bg-gray-50",
  },
  {
    file: "apps/frontend/src/app/modules/[...slug]/module-exemplo-settings.tsx",
    rule: "Tailwind direct color",
    value: "text-blue-900",
  },
  {
    file: "apps/frontend/src/app/modules/[...slug]/module-exemplo-settings.tsx",
    rule: "Tailwind direct color",
    value: "border-green-200",
  },
  {
    file: "apps/frontend/src/app/modules/[...slug]/module-exemplo-settings.tsx",
    rule: "Tailwind direct color",
    value: "bg-green-50",
  },
  {
    file: "apps/frontend/src/app/modules/[...slug]/module-exemplo-settings.tsx",
    rule: "Tailwind direct color",
    value: "text-green-600",
  },
  {
    file: "apps/frontend/src/app/modules/[...slug]/module-exemplo-settings.tsx",
    rule: "Tailwind direct color",
    value: "text-green-900",
  },
  {
    file: "apps/frontend/src/app/modules/[...slug]/module-exemplo-settings.tsx",
    rule: "Tailwind direct color",
    value: "text-green-700",
  },
  {
    file: "apps/frontend/src/app/modules/[...slug]/module-exemplo-settings.tsx",
    rule: "Tailwind direct color",
    value: "text-blue-600",
  },
  {
    file: "apps/frontend/src/app/modules/[...slug]/module-exemplo-settings.tsx",
    rule: "Tailwind direct color",
    value: "border-blue-600",
  },
  {
    file: "apps/frontend/src/app/modules/[module]/[...slug]/ModulePageClient.tsx",
    rule: "Legacy theme class",
    value: "text-muted-foreground",
  },
  {
    file: "apps/frontend/src/app/modules/[module]/[...slug]/ModulePageClient.tsx",
    rule: "Tailwind direct color",
    value: "bg-blue-50",
  },
  {
    file: "apps/frontend/src/app/modules/[module]/[...slug]/ModulePageClient.tsx",
    rule: "Tailwind direct color",
    value: "border-blue-200",
  },
  {
    file: "apps/frontend/src/app/modules/[module]/[...slug]/ModulePageClient.tsx",
    rule: "Tailwind direct color",
    value: "text-blue-900",
  },
  {
    file: "apps/frontend/src/app/modules/[module]/[...slug]/ModulePageClient.tsx",
    rule: "Tailwind direct color",
    value: "bg-blue-100",
  },
  {
    file: "apps/frontend/src/components/ui/toast.tsx",
    rule: "RGB/HSL color",
    value: "rgba(",
    snippetIncludes: "shadow-[0_8px_32px_rgba(0,0,0,0.28)]",
  },
];

const RULES = [
  {
    name: "Tailwind direct color",
    regex:
      /\b(text|bg|border|ring)-(gray|red|blue|green|yellow|slate|zinc|neutral|stone|orange|amber|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)-\d+\b/g,
  },
  {
    name: "Legacy theme class",
    regex: /\b(text-foreground|text-muted-foreground|bg-background|border-input)\b/g,
  },
  {
    name: "Hex color",
    regex: /(?<!&)#([0-9a-fA-F]{3,8})\b/g,
  },
  {
    name: "RGB/HSL color",
    regex: /(rgb|hsl)a?\(/g,
    validate: (match, content) => {
      const functionCall = extractCssFunctionCall(content, match.index);
      return !functionCall.includes("var(--");
    },
  },
  {
    name: "Inline color style",
    regex:
      /style=\{\{[\s\S]*?\b(color|background|backgroundColor|borderColor|fill|stroke)\s*:\s*([^,}]+)[\s\S]*?\}\}/g,
    validate: (match) => !match[0].includes("var(--"),
  },
];

function walk(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      files.push(...walk(fullPath));
      continue;
    }

    if (TEXT_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function getLineAndColumn(content, index) {
  let line = 1;
  let column = 1;

  for (let i = 0; i < index; i += 1) {
    if (content[i] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return { line, column };
}

function getLineText(content, lineNumber) {
  return content.split(/\r?\n/)[lineNumber - 1] || "";
}

function extractCssFunctionCall(content, startIndex) {
  let index = startIndex;
  let depth = 0;

  while (index < content.length) {
    const char = content[index];

    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return content.slice(startIndex, index + 1);
      }
    }

    index += 1;
  }

  return content.slice(startIndex, index);
}

function isAllowedFinding(finding) {
  return ALLOWED_FINDINGS.some((allowed) => {
    if (allowed.file !== finding.file) {
      return false;
    }

    if (allowed.rule !== finding.rule) {
      return false;
    }

    if (allowed.value !== finding.value) {
      return false;
    }

    if (allowed.snippetIncludes && !finding.snippet.includes(allowed.snippetIncludes)) {
      return false;
    }

    return true;
  });
}

function collectFindings(filePath) {
  const relativePath = path.relative(ROOT_DIR, filePath).replace(/\\/g, "/");
  const content = fs.readFileSync(filePath, "utf8");
  const findings = [];

  for (const rule of RULES) {
    rule.regex.lastIndex = 0;
    let match;

    while ((match = rule.regex.exec(content)) !== null) {
      if (rule.validate && !rule.validate(match, content)) {
        continue;
      }

      const { line, column } = getLineAndColumn(content, match.index);
      const finding = {
        rule: rule.name,
        file: relativePath,
        line,
        column,
        snippet: getLineText(content, line).trim(),
        value: match[0],
      };

      if (!isAllowedFinding(finding)) {
        findings.push(finding);
      }
    }
  }

  return findings;
}

if (!fs.existsSync(TARGET_DIR)) {
  console.error(`Frontend source directory not found: ${TARGET_DIR}`);
  process.exit(1);
}

const sourceFiles = walk(TARGET_DIR);
const findings = sourceFiles.flatMap(collectFindings);

if (findings.length > 0) {
  console.error("Hardcoded colors detected:\n");

  for (const finding of findings) {
    console.error(
      `- ${finding.file}:${finding.line}:${finding.column} [${finding.rule}]`,
    );
    console.error(`  ${finding.snippet}`);
    console.error(`  -> ${finding.value}`);
  }

  console.error(`\nFound ${findings.length} theming violation(s).`);
  process.exit(1);
}

console.log("✅ No hardcoded colors found");
