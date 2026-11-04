# Control de Accesos ThinkTech

Sistema de control de acceso **vehicular y peatonal por QR** para parques
industriales. Administración en la **nube** y validación de accesos en un
**nodo local (edge) en caseta** que opera aun sin internet.

- Arquitectura: [`ARQUITECTURA.md`](./ARQUITECTURA.md)
- Seguridad (SGSI): [`SEGURIDAD-SGSI.md`](./SEGURIDAD-SGSI.md)

## Roles

1. **SUPER_ADMIN** — ThinkTech (proveedor). Global.
2. **ADMIN_PARQUE** — dueño del parque. Gestiona su parque, admins de bodega y caseta.
3. **ADMIN_BODEGA** — altas/bajas de su personal, sus QR y su chart de asistencia.
4. **VIGILANCIA** — caseta: panel en vivo, visitas, apertura manual.

## Estructura

```
apps/api      API en la nube (NestJS + Prisma + PostgreSQL)
apps/web      SPA de administración (React + Vite)
apps/edge     Nodo local de caseta (fase posterior)
packages/shared   Tipos de dominio, roles, QR, contratos
```

## Prerequisitos (equipo de desarrollo)

Este equipo arranca desde cero. Hace falta instalar:

| Herramienta | Versión | Para qué |
|---|---|---|
| **Node.js** | LTS (≥20; instalado 26) | Ejecutar API y web |
| **pnpm** | 9+ | Gestor de paquetes del monorepo |
| **Git** | reciente | Control de versiones |
| **Docker Desktop** | reciente | PostgreSQL local (o instalar PostgreSQL 16 nativo) |

Ver la guía de instalación en [`SETUP-DEV.md`](./SETUP-DEV.md).

## Puesta en marcha del MVP local

> En Windows con Scoop, si un shell nuevo no encuentra `node`/`pnpm`/`psql`,
> recarga el PATH:
> `$env:PATH = [Environment]::GetEnvironmentVariable('PATH','User') + ';' + [Environment]::GetEnvironmentVariable('PATH','Machine')`

```bash
# 1) Dependencias
pnpm install

# 2) Base de datos (PostgreSQL de Scoop)  — o 'pnpm db:up' si usas Docker
pg_ctl start -D $env:PGDATA

# 3) Variables de entorno de la API  (apps/api/.env; ya generado en este equipo)
#    Copia apps/api/.env.example o usa el existente.

# 4) Paquete compartido + Prisma + datos iniciales
pnpm --filter @acceso/shared build
pnpm --filter @acceso/api exec prisma migrate dev
pnpm --filter @acceso/api run db:seed    # super admin inicial
```

Levantar (dos terminales):

```bash
pnpm --filter @acceso/api start:dev      # API  → http://localhost:3001/api
```

```bash
pnpm --filter @acceso/web dev            # Web  → http://localhost:5173
```

Entra con el super admin sembrado (`felipe@thinktech.mx`). Desde ahí: crea el
parque y sus puntos de acceso en **Configuración**, bodegas, personal y sus
**QR**, y prueba el flujo en el **simulador de lector** del panel.

## Generar secretos seguros

```bash
# Node (una vez instalado) — genera una clave de 64 caracteres hex
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Genera uno distinto para `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` y `QR_SIGNING_SECRET`.

---

© ThinkTech / IntegraTECH. Código privado.
