#!/usr/bin/env node
/**
 * ensure-prisma-client.js
 *
 * Verifica se o Prisma Client já foi gerado em node_modules/.prisma/client.
 * Se não estiver presente, executa `prisma generate` automaticamente.
 * Esse script é chamado antes do Jest para garantir que os testes não falhem
 * por falta do cliente gerado.
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const clientIndexPath = path.resolve(
  __dirname,
  "..",
  "node_modules",
  ".prisma",
  "client",
  "index.js"
);

const clientExists = fs.existsSync(clientIndexPath);

if (clientExists) {
  console.log("[ensure-prisma-client] Prisma Client já está gerado. OK.");
  process.exit(0);
}

console.log(
  "[ensure-prisma-client] Prisma Client não encontrado. Executando prisma generate..."
);

try {
  execSync("pnpm exec prisma generate", {
    stdio: "inherit",
    cwd: path.resolve(__dirname, ".."),
  });
  console.log("[ensure-prisma-client] prisma generate concluído. OK.");
  process.exit(0);
} catch (error) {
  console.error(
    "[ensure-prisma-client] Falha ao executar prisma generate:",
    error.message
  );
  process.exit(1);
}
