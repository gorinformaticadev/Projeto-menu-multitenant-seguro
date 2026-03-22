import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const nextOutputPath = resolve(process.cwd(), ".next");

if (existsSync(nextOutputPath)) {
  rmSync(nextOutputPath, { recursive: true, force: true });
}
