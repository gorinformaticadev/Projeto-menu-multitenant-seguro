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
    regex: /#([0-9a-fA-F]{3,8})/g,
  },
  {
    name: "RGB/HSL color",
    regex: /(rgb|hsl)a?\(/g,
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
      findings.push({
        rule: rule.name,
        file: relativePath,
        line,
        column,
        snippet: getLineText(content, line).trim(),
        value: match[0],
      });
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
