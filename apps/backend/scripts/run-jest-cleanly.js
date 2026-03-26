#!/usr/bin/env node
/**
 * run-jest-cleanly.js
 *
 * Executa o Jest com configuração limpa, garantindo que variáveis de ambiente
 * de teste estejam corretas e que o processo termine com o código de saída
 * adequado. Também lida com erros de inicialização de forma legível.
 */

const { spawnSync } = require("child_process");
const path = require("path");

// Garante NODE_ENV=test para todos os testes
process.env.NODE_ENV = "test";

// Localiza o binário do jest dentro do node_modules local
const jestBin = path.resolve(__dirname, "..", "node_modules", ".bin", "jest");

console.log("[run-jest-cleanly] Iniciando Jest...");

const result = spawnSync("pnpm", ["exec", "jest", ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: path.resolve(__dirname, ".."),
  shell: true,
  env: {
    ...process.env,
    NODE_ENV: "test",
    FORCE_COLOR: "1",
  },
});

if (result.error) {
  console.error("[run-jest-cleanly] Falha ao iniciar Jest:", result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
