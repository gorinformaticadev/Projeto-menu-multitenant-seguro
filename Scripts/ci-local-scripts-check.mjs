import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

const syntaxScripts = [
  "install/install.sh",
  "install/update.sh",
  "install/update-native.sh",
  "install/rollback-native.sh",
  "install/release-retention.sh",
  "install/restore-native.sh",
  "install/restore-db.sh",
  "install/update-images.sh",
  "install-2/utils/native-utils.sh",
  "install-2/utils/docker-install.sh",
  "Scripts/migrate-uploads.sh",
];

const shellcheckScripts = [
  "install/update-native.sh",
  "install/rollback-native.sh",
  "install/release-retention.sh",
  "install/restore-native.sh",
  "install/restore-db.sh",
  "install/update-images.sh",
  "Scripts/migrate-uploads.sh",
];

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    if (result.error.code === "ENOENT") {
      return false;
    }
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }

  return true;
}

for (const script of syntaxScripts) {
  if (!existsSync(resolve(repoRoot, script))) {
    console.error(`Script obrigatorio nao encontrado: ${script}`);
    process.exit(1);
  }
}

if (run("bash", ["--version"])) {
  for (const script of syntaxScripts) {
    run("bash", ["-n", script]);
  }
  console.log("syntax OK");
} else {
  console.warn("bash nao encontrado no PATH; validacao bash -n ignorada nesta maquina.");
}

if (run("shellcheck", ["--version"])) {
  run("shellcheck", ["-x", "-e", "SC1090,SC1091", ...shellcheckScripts]);
  console.log("shellcheck OK");
} else {
  console.warn("shellcheck nao instalado; etapa opcional ignorada.");
}

run("node", ["Scripts/tests/installer-redis-auth-regression.js"]);

console.log("scripts-check OK");
