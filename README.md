# Control de Accesos ThinkTech

Sistema de control de acceso **vehicular y peatonal por QR** para parques
industriales. Administración en la **nube** y validación de accesos en un
**nodo local (edge) en caseta** que opera aun sin internet.

> **Empieza aquí:** [`GUIA-MAESTRA.md`](./GUIA-MAESTRA.md) — índice de toda la
> documentación y el estado actual del sistema.

### Documentación
| Documento | Para qué |
|---|---|
| [`GUIA-MAESTRA.md`](./GUIA-MAESTRA.md) | Índice general y estado actual |
| [`EXPLICACION-GENERAL.md`](./EXPLICACION-GENERAL.md) | Cómo funciona TODO (incluye cómo la cámara/pistola lee el QR) |
| [`ARQUITECTURA.md`](./ARQUITECTURA.md) | Arquitectura nube + caseta |
| [`SEGURIDAD-SGSI.md`](./SEGURIDAD-SGSI.md) | Seguridad |
| [`SETUP-DEV.md`](./SETUP-DEV.md) | Entorno de desarrollo |
| [`DESPLIEGUE-AWS.md`](./DESPLIEGUE-AWS.md) | Nube (EC2): desplegar, operar, actualizar |
| [`CONTROLADORA-CASETA.md`](./CONTROLADORA-CASETA.md) | Instalar la controladora (Ubuntu Server) |
| [`OPERACION-CASETA.md`](./OPERACION-CASETA.md) | Operar la caseta (roles de cámara, en vivo) |
| [`GUIA-CLIENTE-CASETA.md`](./GUIA-CLIENTE-CASETA.md) | Guía simple para el cliente (corte de luz, etc.) |
| [`DEFINICION-PRUEBAS-HIKVISION.md`](./DEFINICION-PRUEBAS-HIKVISION.md) | Pistola QR (HID) + Hikvision DS-K2812 (ISAPI) |

Repositorio **público**: `https://github.com/GabChung001/CA-TEST` (se clona sin token).

## Roles

1. **SUPER_ADMIN** — ThinkTech (proveedor). Global.
2. **ADMIN_PARQUE** — dueño del parque. Gestiona su parque, admins de bodega y caseta.
3. **ADMIN_BODEGA** — altas/bajas de su personal, sus QR y su chart de asistencia.
4. **VIGILANCIA** — caseta: panel en vivo, visitas, apertura manual.

## Estructura

```
apps/api      API (la MISMA corre en la nube y en la caseta; el rol lo define SYNC_ROLE)
apps/web      SPA de administración y panel (React + Vite)
packages/shared   Tipos de dominio, roles, QR, contratos
scripts/      deploy, lectores (cámara/pistola), barrera, operación de caseta
```
La **caseta/edge** no es un proyecto aparte: es `apps/api` con `SYNC_ROLE=edge`
(ya desplegado y en operación). Ver [`ARQUITECTURA.md`](./ARQUITECTURA.md).

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
**QR**. Los QR se validan en la **controladora de la caseta** (cámara o pistola);
ver [`CONTROLADORA-CASETA.md`](./CONTROLADORA-CASETA.md) y [`OPERACION-CASETA.md`](./OPERACION-CASETA.md).

## Generar secretos seguros

```bash
# Node (una vez instalado) — genera una clave de 64 caracteres hex
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Genera uno distinto para `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` y `QR_SIGNING_SECRET`.

---

© ThinkTech / IntegraTECH.
