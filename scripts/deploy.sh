#!/usr/bin/env bash
# Despliegue/actualización de la instancia (nube o controladora) desde GitHub.
# Uso:  bash scripts/deploy.sh
# Requisito (una sola vez): configurar el remoto con un PAT, p. ej.
#   git remote set-url origin https://TU_PAT@github.com/GabChung001/CA-TEST.git
set -euo pipefail

# Ir a la raíz del repo (este script vive en scripts/)
cd "$(dirname "$0")/.."

echo ">> Trayendo últimos cambios de GitHub…"
git fetch origin
git reset --hard origin/main
git clean -fd            # quita archivos sueltos no versionados (respeta .gitignore → tu .env se conserva)

echo ">> Instalando dependencias…"
pnpm install

echo ">> Prisma: generar cliente y aplicar migraciones…"
pnpm --filter @acceso/shared build
pnpm --filter @acceso/api exec prisma generate
pnpm --filter @acceso/api exec prisma migrate deploy

echo ">> Compilando API y web…"
pnpm --filter @acceso/api build
pnpm --filter @acceso/web build

echo ">> Publicando la web en nginx…"
sudo cp -r apps/web/dist/* /usr/share/nginx/html/

echo ">> Reiniciando la API…"
sudo systemctl restart acceso-api

echo ">> LISTO. Versión activa: $(git -c core.pager=cat log --oneline -1)"
