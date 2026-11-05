# Operación de la controladora (caseta)

Cómo **activar** el sistema en la controladora y cómo **designar a cada cámara/tótem
su rol de entrada o salida**. (La instalación está en [CONTROLADORA-CASETA.md](CONTROLADORA-CASETA.md).)

## 1. Activar / arrancar
Los tres servicios **arrancan solos al prender la máquina** (están `enabled`):

| Servicio | Qué hace |
|---|---|
| `acceso-api` | El cerebro: valida accesos, anti-passback, sincroniza con la nube |
| `nginx` | Sirve el panel web (puerto 80) |
| `acceso-lector` | La **cámara como tótem**: lee QR y registra accesos |

Comandos (en la controladora):
```bash
# Ver estado
systemctl status acceso-api acceso-lector nginx
# Arrancar / reiniciar / detener
sudo systemctl start   acceso-lector
sudo systemctl restart acceso-lector
sudo systemctl stop    acceso-lector
# Ver accesos en vivo (log del lector)
sudo journalctl -u acceso-lector -f
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
En la controladora, un solo comando:
```bash
cd ~/Control-de-Accesos
PW=dev bash scripts/designar-lector.sh ENTRADA_VEHICULAR /dev/video0
```
- Cambia el **TIPO** por el rol deseado (`ENTRADA_VEHICULAR`, `SALIDA_PEATONAL`, …).
- Cambia `/dev/video0` por la cámara que corresponda.

El script registra la cámara como dispositivo en un punto de ese tipo, la deja
leyendo/validando contra ese punto y reinicia el servicio. **Para cambiar el rol,
vuelve a correrlo con otro TIPO.**

## 5. Varias cámaras a la vez (entrada Y salida)
Una cámara = un rol. Para operar entrada y salida simultáneas necesitas **una cámara
por carril**, cada una con su propio servicio lector apuntando a su `/dev/videoN` y su
dispositivo (`acceso-lector-entrada`, `acceso-lector-salida`). Pídeme y te dejo el
segundo servicio configurado.

## 6. Monitoreo
- **En vivo (log):** `sudo journalctl -u acceso-lector -f` → verás `AUTORIZADO` / `RECHAZADO`.
- **Historial / panel:** http://IP-DE-LA-CONTROLADORA → *Historial de accesos* / *Panel de vigilancia*.
- Todo **sube a la nube** para los reportes centrales del parque.

## Notas
- La controladora sincroniza **solo su parque** (`PARQUE_ID` en `apps/api/.env`).
- Si no hay un punto del tipo pedido, créalo primero en la nube (paso 3).
- El lector de cámara (`zbarcam`) funciona headless; el **lector por navegador** (cámara web
  de la página) requiere HTTPS o `localhost`.
