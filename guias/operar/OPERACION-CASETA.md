# Operación de la controladora (caseta)

Cómo **activar** el sistema en la controladora y cómo **designar a cada cámara/tótem
su rol de entrada o salida**. (La instalación está en [CONTROLADORA-CASETA.md](../desplegar/CONTROLADORA-CASETA.md).)

## 1. Activar / arrancar
Los tres servicios **arrancan solos al prender la máquina** (están `enabled`):

| Servicio | Qué hace |
|---|---|
| `acceso-api` | El cerebro: valida accesos, anti-passback, sincroniza con la nube |
| `nginx` | Sirve el panel web (puerto 80) |
| `acceso-lector@<rol>` | Una **cámara como tótem** por rol: lee QR y registra accesos. Hay una instancia por cámara (p. ej. `acceso-lector@entrada`, `acceso-lector@salida`). |

Comandos (en la controladora):
```bash
# Ver estado (todas las instancias de lector)
systemctl status acceso-api nginx "acceso-lector@*"
# Arrancar / reiniciar / detener una cámara concreta
sudo systemctl restart acceso-lector@entrada
sudo systemctl restart acceso-lector@salida
# Ver accesos en vivo de una cámara
sudo journalctl -u acceso-lector@entrada -f
# Ver TODAS las cámaras a la vez
sudo journalctl -f -u "acceso-lector@entrada" -u "acceso-lector@salida"
```
Panel web: **http://IP-DE-LA-CONTROLADORA** (p. ej. http://192.168.100.63).

## 2. El rol entrada/salida = el PUNTO de acceso
Una cámara **no tiene rol propio**: su rol lo da el **punto de acceso** al que se asigna.
Tipos de punto:
- `ENTRADA_VEHICULAR`, `SALIDA_VEHICULAR`
- `ENTRADA_PEATONAL`, `SALIDA_PEATONAL`

Una cámara = un **dispositivo** registrado en un punto = ese rol.

## 3. Crear los puntos (en la NUBE / admin)
En el panel de la **nube** (como super admin o admin de parque) →
**Configuración → Puntos de acceso** → crea los puntos del parque (entrada y salida,
vehicular y peatonal). Se **sincronizan solos** a la controladora.

## 4. Designar una cámara a entrada o salida
Cada cámara es una **instancia** con nombre (`acceso-lector@<nombre>`). Un comando:
```bash
cd ~/Control-de-Accesos
# <nombre> <cámara> <TIPO>  -> crea el dispositivo en esta controladora
PW=dev bash scripts/designar-lector.sh entrada /dev/video0 ENTRADA_VEHICULAR
# o, si ya creaste el dispositivo en la NUBE, pega su apiKey en vez del TIPO:
PW=dev bash scripts/designar-lector.sh salida /dev/video4 <id>.<secreto>
```
- `<nombre>` = etiqueta de la instancia (entrada, salida, entrada-peatonal, …).
- `<cámara>` = `/dev/videoN` de esa cámara (ver `v4l2-ctl --list-devices`).
- Tercer dato: el **TIPO** del punto (`ENTRADA_VEHICULAR`, `SALIDA_PEATONAL`, …)
  para crear el dispositivo aquí, **o** la **apiKey** (`<id>.<secreto>`) si el
  dispositivo ya se creó en la nube.

El script deja esa cámara leyendo/validando contra su punto y arranca/reinicia su
servicio `acceso-lector@<nombre>` (queda habilitado al arranque).

## 5. Varias cámaras a la vez (entrada Y salida)
Una cámara = un rol. Corre `designar-lector.sh` una vez por cámara con un **nombre
distinto**; cada una queda como su propio servicio:
```bash
PW=dev bash scripts/designar-lector.sh entrada /dev/video0 ENTRADA_VEHICULAR
PW=dev bash scripts/designar-lector.sh salida  /dev/video4 SALIDA_VEHICULAR
systemctl status "acceso-lector@*"
```
Para **cambiar el rol o la cámara** de una instancia, vuelve a correr el comando con
el mismo `<nombre>`. Para **quitarla**: `sudo systemctl disable --now acceso-lector@<nombre>`.

## 6. Monitoreo
- **En vivo (log):** `sudo journalctl -u acceso-lector -f` → verás `AUTORIZADO` / `RECHAZADO`.
- **Historial / panel:** http://IP-DE-LA-CONTROLADORA → *Historial de accesos* / *Panel de vigilancia*.
- Todo **sube a la nube** para los reportes centrales del parque.

## Notas
- La controladora sincroniza **solo su parque** (`PARQUE_ID` en `apps/api/.env`).
- Si no hay un punto del tipo pedido, créalo primero en la nube (paso 3).
- El lector de cámara (`zbarcam`) funciona headless; el **lector por navegador** (cámara web
  de la página) requiere HTTPS o `localhost`.
