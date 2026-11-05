# Registro de controladoras (una por parque)

Cada **parque industrial** tiene su propia **controladora de caseta** (el "cerebro"
edge). Los accesos son **por parque/bodega**: una controladora **solo** sincroniza
y valida el catálogo de **su** parque. Se designa con la variable `PARQUE_ID` en su
`.env` (ver [CONTROLADORA-CASETA.md](CONTROLADORA-CASETA.md)).

## Cómo se designa a su parque
1. En la web (nube), como super admin, ve a **Configuración → Parques**.
2. Copia el **`PARQUE_ID`** del parque correspondiente.
3. En la controladora, en `apps/api/.env`, pon ese valor en `PARQUE_ID` y reinicia:
   ```bash
   sudo systemctl restart acceso-api
   ```
4. A partir de ahí, esa controladora baja de la nube **solo** personas, bodegas,
   credenciales y puntos **de ese parque**, y rechaza QR de otros parques.

## Regla de alcance (importante)
- **Catálogo que recibe la controladora** = el de **su** `PARQUE_ID`.
- **QR válido** = el de una persona de una bodega **de ese parque**, vigente y no bloqueada.
- Un QR de **otro parque** → `QR_NO_RECONOCIDO` (no está en el catálogo local) → no abre.

## Inventario de controladoras
> Llena una fila por caseta. El `PARQUE_ID` lo tomas de Configuración → Parques.

| Parque (nombre) | PARQUE_ID | Caseta / ubicación | Hardware (mini PC / Raspberry) | IP en LAN | Estado |
|---|---|---|---|---|---|
| _Ej: ElitePark_ | _cmw2…_ | _Entrada principal_ | _Raspberry Pi 5_ | _192.168.1.50_ | _Operativa_ |
|  |  |  |  |  |  |
|  |  |  |  |  |  |

## Checklist por controladora
- [ ] SO instalado (Ubuntu Server / Raspberry Pi OS 64-bit) + SSH.
- [ ] Dependencias y código (ver [CONTROLADORA-CASETA.md](CONTROLADORA-CASETA.md)).
- [ ] `.env` con `SYNC_ROLE=edge`, `CLOUD_URL`, `EDGE_SYNC_KEY` (= nube),
      `QR_SIGNING_SECRET` (= nube) y **`PARQUE_ID`** (su parque).
- [ ] Servicio `acceso-api` activo y sincronizando (logs: "Sincronización edge activa").
- [ ] Puntos de acceso del parque creados en la nube (bajan por sync).
- [ ] Lectoras apuntando a la controladora; relé/ESP32 conectado.
