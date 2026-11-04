# Seguridad (SGSI) — Control de Accesos ThinkTech

Lineamientos de seguridad del sistema, alineados a buenas prácticas de un SGSI
(ISO/IEC 27001). Objetivo: un sistema **seguro por diseño**, sin las clases de
vulnerabilidad comunes (inyección, credenciales débiles, exposición de datos).

> **Decisión base:** stack **Node.js/TypeScript (NestJS) + Prisma + PostgreSQL**, 
> **sin PHP**. Prisma genera consultas parametrizadas → se elimina la inyección SQL
> por construcción. Toda entrada se valida con esquema (class-validator / zod).

---

## 1. Autenticación

- Contraseñas con **Argon2id** (nunca texto plano, nunca MD5/SHA simple).
- **MFA (TOTP) obligatorio** para `SUPER_ADMIN`, `ADMIN_PARQUE` y `ADMIN_BODEGA`.
- **Bloqueo por fuerza bruta:** conteo de intentos + bloqueo temporal (`bloqueadoHasta`).
- Tokens **JWT de acceso corto** (15 min) + **refresh** en cookie `httpOnly`, `Secure`, `SameSite`.
  Solo se almacena el **hash** del refresh (tabla `Sesion`); permite revocación.
- Cierre de sesión revoca el refresh; expiración y rotación de tokens.

## 2. Autorización (RBAC)

- 4 roles (`SUPER_ADMIN`, `ADMIN_PARQUE`, `ADMIN_BODEGA`, `VIGILANCIA`).
- **Se verifica SIEMPRE en el servidor** mediante *guards*; el frontend solo oculta UI.
- **Aislamiento por inquilino (tenant):** cada consulta se filtra por `parqueId` /
  `bodegaId` del usuario. Un admin de bodega jamás ve datos de otra bodega.
- Principio de **mínimo privilegio** (ver matriz en `packages/shared`).

## 3. Protección de datos

- **TLS en todo** (nube y, en la medida de lo posible, canal interno de caseta).
- **Cifrado en reposo** de la base y de campos sensibles (p. ej. `mfaSecret`).
- **Gestión de secretos** por variables de entorno / bóveda; nunca en el código ni en el repo
  (`.env` está en `.gitignore`; solo se versiona `.env.example`).
- **Datos personales (LFPDPPP):** aviso de privacidad del responsable del parque,
  minimización de datos, y **plazos de retención** acordados para visitantes y movimientos.

## 4. Canal nube ↔ caseta (edge)

- Autenticación mutua del edge con la nube (**mTLS** o API key firmada + rotación).
- Sincronización **idempotente** y con cursor; los movimientos se encolan y suben
  cuando hay internet (sin pérdida ni duplicados).
- El edge solo recibe el **catálogo mínimo necesario** para validar (no todo el histórico).

## 5. Dispositivos (tótems / lectores)

- Cada dispositivo se autentica con **API key propia** (se guarda `apiKeyHash`).
- **Heartbeat** y estado (`OPERATIVO`/`DESCONECTADO`) visibles en el panel.
- El QR usa **firma HMAC** (ver `ARQUITECTURA.md §5`): no se puede forjar sin la clave.

## 6. Aplicación

- Validación estricta de entrada en cada endpoint (tipos, longitudes, formato).
- Cabeceras de seguridad (Helmet: HSTS, CSP, etc.), **CORS** restringido.
- **Rate limiting** global y reforzado en login y validación de acceso.
- Manejo de errores que **no filtra** detalles internos.
- Dependencias: `npm audit` / escaneo en CI, actualizaciones, *lockfile* fijo.

## 7. Auditoría y monitoreo

- **Bitácora de accesos** (`Movimiento`) inmutable: autorizados y rechazados, con motivo.
- **Audit log** de acciones administrativas (`AuditLog`): quién, qué, cuándo, IP → no repudio.
- Apertura **manual** siempre registra operador + motivo.

## 8. Continuidad y respaldos

- La caseta opera **offline** con su réplica → continuidad ante caída de internet.
- Respaldos programados de la BD primaria (nube) y de la réplica local.
- Procedimiento de **contingencia física** acordado si falla el sistema (operación manual de caseta).

## 9. Gestión de vulnerabilidades

- Ciclo de parches del SO del servidor de caseta y de dependencias.
- Revisión de código y pruebas de seguridad antes de liberar.
- Reporte y respuesta ante incidentes.

---

## Mapa rápido a dominios ISO/IEC 27001 (Anexo A)

| Dominio | Cómo se cubre aquí |
|---|---|
| Control de acceso (A.5.15–5.18, 8.2–8.5) | RBAC por rol + tenant, MFA, mínimo privilegio, gestión de sesiones. |
| Criptografía (A.8.24) | Argon2id, HMAC de QR, TLS, cifrado en reposo. |
| Operaciones / registro (A.8.15–8.16) | Bitácora de accesos + audit log + monitoreo de dispositivos. |
| Seguridad de las comunicaciones (A.8.20–8.21) | TLS, mTLS edge↔nube, CORS, rate limiting. |
| Desarrollo seguro (A.8.25–8.28) | ORM parametrizado, validación de entrada, revisión, escaneo de dependencias. |
| Continuidad (A.5.29–5.30) | Operación offline en caseta, respaldos, contingencia física. |
| Protección de datos personales (A.5.34) | LFPDPPP: aviso de privacidad, minimización, retención. |

> Este documento es la línea base; se detalla y formaliza conforme avance la
> implementación y la política de SGSI del parque.
