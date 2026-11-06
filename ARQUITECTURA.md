# Arquitectura — Control de Accesos ThinkTech

Sistema de control de acceso **vehicular y peatonal por QR** para parques
industriales. Administración en la **nube** y validación de accesos en un
**nodo local (edge) en la caseta** que opera aun sin internet.

> **Estado actual (2026-11):** implementado y en operación. Precisiones sobre este
> documento de diseño:
> - El **edge NO es un proyecto aparte** (`apps/edge`): es la MISMA `apps/api` con
>   `SYNC_ROLE=edge`. La misma base de código corre en la nube y en la caseta.
> - El **panel en vivo** se actualiza por **polling cada 3 s** (no WebSocket).
> - El **control de barrera** es el módulo `apps/api/src/barrera` (backends
>   `simulado` y `hikvision` por ISAPI). Ver [DEFINICION-PRUEBAS-HIKVISION.md](./DEFINICION-PRUEBAS-HIKVISION.md).
> - Lectores: **cámara** (`zbarcam`) o **pistola QR HID**. Repo **público**.
> - Índice completo y estado: [GUIA-MAESTRA.md](./GUIA-MAESTRA.md).

---

## 1. Topología

```
          ┌──────────────────────── NUBE (fuente de verdad) ───────────────────────┐
          │                                                                         │
          │   apps/web  ──HTTPS──►  apps/api  ──►  PostgreSQL (BD primaria)          │
          │   (React SPA)           (NestJS)                                        │
          │   Altas/bajas,          Auth + RBAC,                                    │
          │   admin, reportes       catálogo, reportes                              │
          │                                                                         │
          └───────────────▲───────────────────────────────┬─────────────────────────┘
                          │  sync de catálogo (altas/bajas) │  sync de movimientos
                          │  (push on-change + pull periódico)  (cuando hay internet)
          ┌───────────────┴───────────────────────────────▼─────────────────────────┐
          │                      CASETA (nodo edge, local)                           │
          │                                                                          │
          │   apps/edge (NestJS)  ──►  PostgreSQL/SQLite local (réplica)             │
          │     • Valida QR            • Credenciales autorizadas (respaldo)         │
          │     • Anti-passback        • Estado de presencia ADENTRO/AFUERA          │
          │     • Reset 24h            • Cola de movimientos pendientes de subir     │
          │     • Abre barreras                                                      │
          │        │                                                                 │
          │        ├──► Controlador de accesos ──► Plumas / Torniquetes              │
          │        └──◄ Tótems / lectores QR (entrada y salida)                      │
          │                                                                          │
          │   Panel de vigilancia (web local, tiempo real por WebSocket)            │
          └──────────────────────────────────────────────────────────────────────────┘
```

**Principio:** la nube manda en el *catálogo* (quién es válido). La caseta
manda en la *operación en vivo* (quién está adentro, abrir o no). Si se cae
internet, la caseta sigue operando con su réplica; al volver, reconcilia.

---

## 2. Componentes

| Componente | Dónde | Responsabilidad |
|---|---|---|
| `apps/web` | Nube | SPA de administración: altas/bajas, personal, QR, reportes, chart de asistencia por bodega. |
| `apps/api` | Nube | API REST + Auth/RBAC + catálogo (parques, bodegas, personas, credenciales) + generación de QR firmado + reportes. BD primaria. |
| `apps/edge` | Caseta | Servicio local: valida accesos, anti-passback, reset 24h, control de barreras, panel de vigilancia en vivo, sincronización con la nube. |
| Tótem / lector | Caseta | Lee el QR (cámara del dispositivo o lector) y llama a `apps/edge`. |
| Controlador de accesos | Caseta | Recibe la orden de "abrir" del edge y acciona pluma/torniquete. |
| `packages/shared` | — | Tipos de dominio, roles, contrato de validación, formato de QR. |

---

## 3. Flujos principales

### 3.1 Alta / baja (nube → caseta)
1. Un admin da de alta/baja o bloquea en `apps/web` (nube).
2. `apps/api` persiste en la BD primaria y marca el cambio en un *feed de cambios* (cursor incremental).
3. El `apps/edge` recibe el cambio (push si hay internet) o lo toma en su *pull* periódico, y actualiza su réplica local → **este es el "respaldo" que pide la operación**.
4. Si no hay internet, el cambio queda en la nube y el edge lo aplica en cuanto reconecta.

### 3.2 Validación de acceso (100 % local en caseta)
El tótem envía `{ qr, puntoAccesoId }` al edge. El edge valida en orden y
**si algo falla, RECHAZA con motivo** (ver `MotivoRechazo`):
1. Firma HMAC del QR válida → si no, `FIRMA_INVALIDA`.
2. Credencial existe en la réplica → si no, `QR_NO_RECONOCIDO`.
3. No bloqueada / no revocada.
4. Dentro de vigencia.
5. Tipo correcto para el punto (vehicular/peatonal).
6. **Anti-passback** (en ENTRADA: no estar ya `ADENTRO`) → si lo está, `REINGRESO_NO_PERMITIDO`.
7. Autoriza → ordena abrir barrera, marca presencia, registra movimiento, emite al panel en vivo.

> **Salida:** siempre se permite salir; marca `AFUERA`. (Nunca se deja a alguien encerrado.)

### 3.3 Sincronización de movimientos (caseta → nube)
Cada movimiento se guarda local y se encola; cuando hay internet, el edge los
sube a la nube para reportes y auditoría central. Idempotente por `movimientoId`.

---

## 4. Anti-passback y reset de 24 h

- Estado por credencial: `estadoPresencia` = `AFUERA` | `ADENTRO`, **mantenido en el edge**.
- Entrada válida → `ADENTRO` + `ultimaEntradaEn = now`.
- Salida → `AFUERA`.
- **Reset 24 h:** job programado en el edge que, cada cierto intervalo, regresa a
  `AFUERA` toda credencial que siga `ADENTRO` con `ultimaEntradaEn` de hace más de
  `PRESENCIA_RESET_HORAS` (por defecto 24). Evita que alguien quede bloqueado al día
  siguiente por no haber marcado salida.

---

## 5. Diseño del QR (impreso **y** en pantalla)

El personal diario podrá **imprimir y enmicar** su QR (auto o gaffete), así que el
QR es **estático**. La seguridad no depende de que cambie, sino de:

- **Firma HMAC-SHA256** del contenido con `QR_SIGNING_SECRET` → nadie puede forjar
  un QR válido sin la clave. Formato: `TTA1.<codigo>.<firma>`.
- **Validación server-side**: vigencia, estado (bloqueo/baja) y anti-passback se
  resuelven siempre contra la base; un QR fotografiado o copiado sigue sujeto a
  todas las reglas (p. ej. no puede reingresar si ya está adentro).
- El `codigo` embebido es **opaco** (no revela nombre ni datos).

La lectura se toma **desde el dispositivo** del tótem (cámara o lector), que
reporta la cadena cruda al edge.

---

## 6. Los 4 roles (RBAC)

| Rol | Ámbito | Puede |
|---|---|---|
| **SUPER_ADMIN** (ThinkTech) | Global | Todo, en todos los parques. |
| **ADMIN_PARQUE** (dueño del parque) | Su parque | Crear admins de bodega y usuarios de caseta, bloquear personal, ver reportes y movimientos, apertura manual. |
| **ADMIN_BODEGA** | Su bodega | Altas/bajas de su personal y vehículos, generar/bloquear sus QR, ver su chart de asistencia. |
| **VIGILANCIA** (caseta) | Operación | Panel en vivo, registrar visitas, apertura manual (con motivo), consultar credenciales. |

La autorización se verifica **siempre en el servidor** (ver `SEGURIDAD-SGSI.md`).

---

## 7. Stack

- **Backend:** Node.js 20 LTS + TypeScript + **NestJS**. ORM **Prisma** (consultas parametrizadas).
- **Base de datos:** **PostgreSQL 16** (nube) y réplica local en caseta.
- **Frontend:** **React + Vite + TypeScript + Tailwind** (branding ThinkTech: teal + sidebar oscuro).
- **Tiempo real:** WebSocket (panel de vigilancia).
- **Monorepo:** pnpm workspaces. **Sin PHP.**

---

## 8. Estructura del repositorio

```
control-accesos/
├─ apps/
│  ├─ api/      API única (nube o caseta según SYNC_ROLE)  ← schema en prisma/
│  └─ web/      SPA de administración y panel (React/Vite)
├─ scripts/     deploy, lectores (cámara/pistola), barrera, operación de caseta
├─ packages/
│  └─ shared/   Tipos de dominio, roles, QR, contratos
├─ docker-compose.yml   PostgreSQL local
├─ ARQUITECTURA.md · SEGURIDAD-SGSI.md · README.md
```

---

## 9. Roadmap por fases

1. **Base** (este paso): estructura, modelo de datos, tipos, docs.
2. **API nube:** auth + RBAC + MFA, catálogo (parques/bodegas/personas), credenciales + QR firmado.
3. **Web:** login, altas/bajas de personal, generación/impresión de QR, chart de asistencia.
4. **Edge caseta:** validación de acceso, anti-passback, reset 24h, control de barreras, panel en vivo + simulador de lector.
5. **Sincronización** nube↔edge (catálogo y movimientos) y modo offline.
6. **Reportes, endurecimiento SGSI y empaquetado** para el servidor de caseta.

> Hardware real (lector/tótem, controlador, integración con plumas existentes) se
> confirma en visita técnica; por eso el control de barreras y el lector van tras
> una **capa de adaptadores** + simulador, para construir y probar sin el hardware.
