# Comandos manuales — actualizar servidores y probar la Hikvision

Guía de "qué tecleo" para el ambiente de **pruebas**. Dos equipos distintos:

| Nombre | Qué es | IP (pruebas) |
|---|---|---|
| **Controladora (Ubuntu)** | El **cerebro**: valida QR, anti-passback, sincroniza. Corre nuestro software. | `192.168.100.63` |
| **Nube (AWS)** | Administración y reportes (web de altas, base primaria). | IP pública (cambia al reiniciar) |
| **Controladora (Hik)** | El **DS-K2812**: abre las **plumas**. No lee QR en nuestro flujo. | `192.168.100.64` |

> La lectura del QR la hace la **cámara/pistola del Ubuntu**. La **Hikvision solo abre la pluma**.

---

## 1. Actualizar la CONTROLADORA (Ubuntu)

Entra a su terminal (SSH o directo) y teclea:

```bash
cd ~/Control-de-Accesos
PW=dev bash scripts/deploy-caseta.sh
```

Eso trae lo último de GitHub, recompila, publica la web y reinicia los servicios. Tu
`apps/api/.env` **no se toca**. Al final imprime la versión activa.

Ver que quedó bien:
```bash
bash scripts/estado-caseta.sh
```

---

## 2. Actualizar la NUBE (AWS)

Primero conéctate desde tu PC (ajusta el IP si cambió):

```bash
ssh -i "C:\Users\User\Downloads\KEY.pem" ec2-user@IP-DE-AWS
```

Ya dentro de AWS:

```bash
cd ~/Control-de-Accesos
bash scripts/deploy.sh
```

> Si el SSH da *timeout*, es el **Security Group** bloqueando el puerto 22 para tu IP
> actual: ábrelo en la consola de AWS (EC2 → Security Groups → Inbound → puerto 22 →
> tu IP), o entra por **EC2 Instance Connect** desde la consola.

### Si cambió la IP pública de AWS
La web de AWS no necesita cambios (usa rutas relativas). Pero la **controladora** debe
apuntar al nuevo IP. En la terminal del **Ubuntu**:

```bash
cd ~/Control-de-Accesos
sed -i -E "s|^CLOUD_URL=.*|CLOUD_URL=http://NUEVA-IP/api|" apps/api/.env
sudo systemctl restart acceso-api
```

(Para que el IP deje de cambiar: fija una **Elastic IP** en AWS.)

---

## 3. ¿Cuándo hay que actualizar?

- **Cambios de código** (carpetas `apps/`, `packages/`, `scripts/`) → actualiza **los dos**
  (sección 1 y 2). En pruebas, cada vez que haya cambios en GitHub.
- **Solo documentación** (`guias/`, README) → **no** hace falta actualizar ningún servidor.
- En **producción**: solo se actualiza cuando hay una versión nueva que desplegar.

---

## 4. Controladora Hik (DS-K2812) — modificar y probar las plumas

### 4.1 Config del equipo Hik → se hace en **iVMS-4200** (no por web)
El DS-K2812 **no tiene página web** (puerto 80 cerrado); toda su config va por
**iVMS-4200**: activarlo, IP fija (`192.168.100.64`), **tiempo de apertura** de Puerta 1/2,
usuario/clave. Ahí también defines qué puerta es entrada y cuál salida (Door 1 / Door 2).

### 4.2 Cómo abre la pluma desde nuestro sistema
Hoy el Hik solo expone el **SDK (puerto 8000)**, **no ISAPI (puerto 80)**. Por eso hay dos
caminos (ver [../hardware/DEFINICION-PRUEBAS-HIKVISION.md](../hardware/DEFINICION-PRUEBAS-HIKVISION.md)):

- **Relé físico (recomendado si sigue sin ISAPI):** un relé USB en el Ubuntu cableado al
  **botón de salida `B`–`G`** (o al relé `NO`–`COM`) de la Puerta 1 del Hik. En cada acceso
  autorizado, el Ubuntu dispara el relé con `~/abrir-pluma.sh` y el Hik abre.
- **ISAPI por red:** solo si logras habilitar el servicio HTTP/ISAPI en iVMS.

### 4.3 Cambiar el MODO de barrera (en el Ubuntu)
El modo se controla en `apps/api/.env` de la **controladora Ubuntu**. Edita con `nano`
(seguro, cambia solo lo que toques):

```bash
cd ~/Control-de-Accesos
nano apps/api/.env
```

Variables de barrera:
```
BARRERA_MODO=simulado          # simulado | hikvision | ninguno
BARRERA_PULSO_SEG=6            # segundos que queda "abierta"
BARRERA_ESPERA_CIERRE_MS=8000 # cuánto espera a que cierre antes de reabrir
BARRERA_POLITICA_ABIERTA=reabrir   # reabrir | negar
# Solo si usas ISAPI real:
# HIKVISION_URL=http://192.168.100.64
# HIKVISION_USER=admin
# HIKVISION_PASS=tu_clave
# BARRERA_DOOR_ENTRADA=1
# BARRERA_DOOR_SALIDA=2
```

Guarda (`Ctrl+O`, Enter, `Ctrl+X`) y reinicia:
```bash
sudo systemctl restart acceso-api
```
(La controladora pide la contraseña de `sudo`; es `dev`.)

### 4.4 Probar la lógica de la pluma (modo simulado, sin hardware)
Con `BARRERA_MODO=simulado`, deja el log en vivo y escanea QR:

```bash
cd ~/Control-de-Accesos
bash scripts/ver-accesos.sh
```
- Escanea un QR autorizado → verás `PLUMA/BARRERA ABIERTA — abierta`.
- Escanea **otro QR dentro de ~6 s** (mientras "sigue abierta") → verás que **espera el
  cierre** y luego **reabre** (la lógica de "pluma sigue abierta").

### 4.5 Probar el Hik físico (cuando lo cablees)
Pinout real y puntos de prueba en
[../hardware/DEFINICION-PRUEBAS-HIKVISION.md](../hardware/DEFINICION-PRUEBAS-HIKVISION.md) §3:
- **Relé:** multímetro en continuidad entre `COM1` y `NO1` → al abrir, conmuta.
- **Sensor "sigue abierta":** un puente/botón entre `S1` y `G`.
- **Abrir local:** un botón entre `B1` y `G`.

Probar ISAPI desde el Ubuntu (si lo habilitaste):
```bash
curl -s --digest -u admin:TU_PASS http://192.168.100.64/ISAPI/System/deviceInfo
```

---

## 5. Chuleta rápida

| Quiero… | Dónde | Comando |
|---|---|---|
| Actualizar la controladora | Ubuntu | `cd ~/Control-de-Accesos && PW=dev bash scripts/deploy-caseta.sh` |
| Actualizar AWS | AWS | `cd ~/Control-de-Accesos && bash scripts/deploy.sh` |
| Ver estado de la caseta | Ubuntu | `bash scripts/estado-caseta.sh` |
| Ver accesos en vivo | Ubuntu | `bash scripts/ver-accesos.sh` |
| Reiniciar todo (pánico) | Ubuntu | `bash scripts/reiniciar-caseta.sh` |
| Cambiar IP de la nube | Ubuntu | `sed -i -E "s\|^CLOUD_URL=.*\|CLOUD_URL=http://NUEVA-IP/api\|" apps/api/.env && sudo systemctl restart acceso-api` |
| Cambiar modo de barrera | Ubuntu | `nano apps/api/.env` → `sudo systemctl restart acceso-api` |
