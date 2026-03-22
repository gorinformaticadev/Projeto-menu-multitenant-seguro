import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

// Utilitario manual de recuperacao.
// O build e o typecheck devem permanecer verdes sem depender desta limpeza.
const nextOutputPath = resolve(process.cwd(), ".next");

if (existsSync(nextOutputPath)) {
  rmSync(nextOutputPath, { recursive: true, force: true });
}
