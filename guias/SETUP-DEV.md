# Setup del entorno de desarrollo (Windows, desde cero)

Este equipo no tiene toolchain instalado (ni `winget`). Hay dos caminos; el
recomendado es **Scoop** porque instala en espacio de usuario (sin requerir
administrador) y deja todo versionable y fácil de actualizar.

---

## Opción A — Scoop (recomendada, sin admin)

Abre **PowerShell** (del usuario, no como admin) y ejecuta:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
```

Luego instala el toolchain:

```powershell
scoop install nodejs-lts pnpm git postgresql
```

Verifica:

```powershell
node --version; pnpm --version; git --version; psql --version
```

> Con `postgresql` de Scoop no necesitas Docker. Si prefieres Docker, ve la Opción C.

---

## Opción B — Instaladores oficiales (requiere admin)

Descarga e instala manualmente:

1. **Node.js 20 LTS** — https://nodejs.org/en/download (instalador Windows x64).
2. **Git** — https://git-scm.com/download/win.
3. **pnpm** (tras instalar Node): `corepack enable && corepack prepare pnpm@latest --activate`.
4. **PostgreSQL 16** — https://www.postgresql.org/download/windows/ (instalador EDB).

---

## Opción C — Docker Desktop para la base de datos

Si instalas **Docker Desktop** (requiere admin + WSL2), no necesitas PostgreSQL
nativo: la base la levanta el `docker-compose.yml` del repo.

```powershell
pnpm db:up     # levanta PostgreSQL 16 en localhost:5432
```

---

## Después de instalar

> **Estado actual:** la API (NestJS) y la web (React) **ya están construidas** y en
> operación. El repo es **público** (`https://github.com/GabChung001/CA-TEST`), se clona
> sin token. Este equipo Windows es **solo desarrollo**: su `apps/api/.env` quedó en
> `SYNC_ROLE=cloud` standalone (no sincroniza ni empuja a AWS).

```powershell
# En la carpeta del proyecto:
pnpm install
pnpm --filter @acceso/shared build
pnpm --filter @acceso/api exec prisma migrate dev
pnpm --filter @acceso/api run db:seed      # super admin inicial
```

Levantar (dos terminales): `pnpm --filter @acceso/api start:dev` (API) y
`pnpm --filter @acceso/web dev` (web). Puesta en marcha completa en el
[`README.md`](../README.md); índice general en [`GUIA-MAESTRA.md`](./GUIA-MAESTRA.md).

> Nota: en este equipo el toolchain se instaló con **Scoop** sin cambiar la política de
> ejecución global (Node 26 / pnpm / PostgreSQL por Scoop). Si un shell nuevo no encuentra
> `node`/`pnpm`/`psql`, recarga el PATH (ver README).
