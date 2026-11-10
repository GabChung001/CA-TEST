#!/usr/bin/env bash
# Despliegue para la CONTROLADORA de caseta (igual que deploy.sh pero el sudo usa
# contraseña por stdin, porque el usuario de la caseta no tiene sudo sin contraseña).
# Uso:  PW=dev bash scripts/deploy-caseta.sh
set -euo pipefail
PW="${PW:-dev}"
cd "$(dirname "$0")/.."

echo ">> Trayendo últimos cambios de GitHub…"
git fetch origin
git reset --hard origin/main
git clean -fd            # respeta .gitignore → tu .env se conserva

echo ">> Instalando dependencias…"
pnpm install

echo ">> Prisma + build…"
pnpm --filter @acceso/shared build
pnpm --filter @acceso/api exec prisma generate
pnpm --filter @acceso/api exec prisma migrate deploy
pnpm --filter @acceso/api build
pnpm --filter @acceso/web build

echo ">> Publicando la web en nginx…"
ROOT=$(echo "$PW" | sudo -S nginx -T 2>/dev/null | grep -m1 -oP 'root\s+\K[^;]+' | tr -d ' ')
[ -z "$ROOT" ] && ROOT=/var/www/html
echo "$PW" | sudo -S cp -r apps/web/dist/* "$ROOT"/

echo ">> Reiniciando API y lectores…"
echo "$PW" | sudo -S systemctl restart acceso-api
echo "$PW" | sudo -S systemctl restart 'acceso-lector@*' 2>/dev/null || true

echo ">> LISTO. Versión activa: $(git -c core.pager=cat log --oneline -1)"
