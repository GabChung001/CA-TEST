# Guía maestra — Control de Accesos ThinkTech

Punto de entrada a **toda** la documentación, con el **estado actual** del sistema.
Si no sabes por dónde empezar, empieza aquí.

---

## Estado actual (2026-11)

Arquitectura **B** en operación:

- **Nube (AWS EC2)** = administración y reportes. La web de altas/QR y la base de datos
  primaria. Repo **público** en GitHub, se actualiza con `deploy.sh`.
- **Controladora de caseta** = un **Ubuntu Server** (la misma `apps/api` con
  `SYNC_ROLE=edge`). Valida los QR localmente, opera **sin internet** y sincroniza con la
  nube (push inmediato + ciclo). Hoy en pruebas: `192.168.100.63`, parque ElitePark.
- **Lector de QR:** por ahora **cámara web** (`zbarcam`); la **pistola QR (HID)** ya está
  programada y lista para cuando llegue.
- **Barrera/pluma:** módulo `apps/api/src/barrera`. Hoy en **`simulado`**; listo para
  **Hikvision DS-K2812 por ISAPI** cuando se conecte.
- **Panel** en vivo con auto-refresco cada 3 s (accesos, personas dentro, rechazos).

Repositorio: **https://github.com/GabChung001/CA-TEST** (público, se clona sin token).

---

## ¿Qué quieres hacer? → qué documento leer

| Quiero… | Documento |
|---|---|
| Entender **todo** el sistema (incl. cómo se lee/descifra el QR) | [entender/EXPLICACION-GENERAL.md](./entender/EXPLICACION-GENERAL.md) |
| Ver la **arquitectura** nube + caseta | [entender/ARQUITECTURA.md](./entender/ARQUITECTURA.md) |
| **Desplegar/operar/actualizar la nube (AWS)** | [desplegar/DESPLIEGUE-AWS.md](./desplegar/DESPLIEGUE-AWS.md) |
| **Instalar una controladora** (Ubuntu Server) | [desplegar/CONTROLADORA-CASETA.md](./desplegar/CONTROLADORA-CASETA.md) |
| **Operar la caseta** (roles de cámara, ver en vivo) | [operar/OPERACION-CASETA.md](./operar/OPERACION-CASETA.md) |
| Dar al **cliente** una guía simple (corte de luz, etc.) | [operar/GUIA-CLIENTE-CASETA.md](./operar/GUIA-CLIENTE-CASETA.md) |
| **Registro de controladoras** (una por parque) | [desplegar/CONTROLADORAS.md](./desplegar/CONTROLADORAS.md) |
| **Pistola QR + Hikvision** (pruebas de barrera) | [hardware/DEFINICION-PRUEBAS-HIKVISION.md](./hardware/DEFINICION-PRUEBAS-HIKVISION.md) |
| **Seguridad (SGSI)** | [entender/SEGURIDAD-SGSI.md](./entender/SEGURIDAD-SGSI.md) |
| **Entorno de desarrollo** | [desplegar/SETUP-DEV.md](./desplegar/SETUP-DEV.md) |

---

## Accesos rápidos (comandos)

**Actualizar la nube (AWS):**
```bash
ssh -i "C:\Users\User\Downloads\KEY.pem" ec2-user@IP-AWS
cd ~/Control-de-Accesos && bash scripts/deploy.sh
```

**Actualizar la controladora:**
```bash
cd ~/Control-de-Accesos && bash scripts/deploy.sh
```

**Operar la caseta (en el Ubuntu Server):**
```bash
bash scripts/estado-caseta.sh        # estado de todos los servicios
bash scripts/ver-accesos.sh          # accesos en vivo (todas las cámaras)
bash scripts/reiniciar-caseta.sh     # reinicio total (botón de pánico)
```

**Designar un lector a un rol:**
```bash
# Cámara:
PW=dev bash scripts/designar-lector.sh entrada /dev/v4l/by-id/usb-...-index0 ENTRADA_VEHICULAR
# Pistola QR (HID), cuando llegue:
PW=dev bash scripts/designar-scanner.sh entrada /dev/input/by-id/usb-...-event-kbd ENTRADA_VEHICULAR
```

**Cambiar la barrera a Hikvision real (cuando se conecte):** en `apps/api/.env` de la
controladora poner `BARRERA_MODO=hikvision` + `HIKVISION_URL/USER/PASS`, y
`sudo systemctl restart acceso-api`. Detalle en [hardware/DEFINICION-PRUEBAS-HIKVISION.md](./hardware/DEFINICION-PRUEBAS-HIKVISION.md).

---

## Datos clave

- **Roles:** SUPER_ADMIN (ThinkTech), ADMIN_PARQUE, ADMIN_BODEGA, VIGILANCIA.
- **QR:** `TTA1.<codigo>.<firma>` firmado con HMAC (`QR_SIGNING_SECRET`, igual en nube y caseta).
- **Alcance por parque:** cada controladora atiende **un** parque (`PARQUE_ID`).
- **Endpoint de validación (lector):** `POST /api/acceso/dispositivo/validar` con `x-api-key`.
- **Servicios de la caseta:** `acceso-api`, `nginx`, `postgresql`, `acceso-lector@<rol>`
  (y `acceso-scanner@<rol>` para pistola). Todos arrancan solos al prender.
- **IP de AWS:** cambia al reiniciar la instancia (salvo Elastic IP). Si cambia, actualiza
  `CLOUD_URL` de la controladora.

---

## Pendientes / próximos pasos

- Conectar el **Hikvision DS-K2812** por red y pasar la barrera a `BARRERA_MODO=hikvision`.
- Activar la **pistola QR (HID)** cuando llegue (`designar-scanner.sh`).
- (Opcional) **Elastic IP** en AWS para que la IP no cambie al reiniciar.
- Fase 2 (propuesta): aprobación de visitas por empresa, LPR de placas.
