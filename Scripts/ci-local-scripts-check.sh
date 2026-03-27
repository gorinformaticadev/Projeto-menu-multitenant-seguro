#!/usr/bin/env bash
set -euo pipefail

syntax_scripts=(
  "install/install.sh"
  "install/update.sh"
  "install/update-native.sh"
  "install/rollback-native.sh"
  "install/release-retention.sh"
  "install/restore-native.sh"
  "install/restore-db.sh"
  "install/update-images.sh"
  "install-2/utils/native-utils.sh"
  "install-2/utils/docker-install.sh"
  "Scripts/migrate-uploads.sh"
)

for script in "${syntax_scripts[@]}"; do
  if [[ ! -f "$script" ]]; then
    echo "Script obrigatorio nao encontrado: $script"
    exit 1
  fi
  chmod +x "$script"
  bash -n "$script"
done

echo "✔ syntax OK"

if command -v shellcheck >/dev/null 2>&1; then
  shellcheck_scripts=(
    "install/update-native.sh"
    "install/rollback-native.sh"
    "install/release-retention.sh"
    "install/restore-native.sh"
    "install/restore-db.sh"
    "install/update-images.sh"
    "Scripts/migrate-uploads.sh"
  )

  shellcheck -x -e SC1090,SC1091 "${shellcheck_scripts[@]}"
  echo "✔ shellcheck OK"
else
  echo "⚠ shellcheck não instalado (CI usa, local opcional)"
fi

node Scripts/tests/installer-redis-auth-regression.js

echo "✔ scripts-check OK"