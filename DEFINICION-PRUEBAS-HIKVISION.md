# Definición de pruebas — Pistola QR (HID) + Hikvision DS-K2812 (ISAPI)

Cómo dejaremos la **controladora Ubuntu** para las pruebas de entorno: leer el QR con
una **pistola de código (tipo teclado/HID)** y abrir/controlar la **pluma** a través del
**Hikvision DS-K2812 por red (ISAPI)**, incluyendo la validación de "**la pluma sigue
abierta**". Documento de preparación; la parte de código se implementa aparte.

---

## 0. Esquema general

```
  [Pistola QR/HID] ──USB──► [Ubuntu controladora] ──LAN/ISAPI──► [DS-K2812] ──relé──► [Pluma]
        (teclea el código)        (valida el QR,                    (abre puerta,      ▲
                                   decide, ordena abrir)             sensa estado) ─────┘
                                                                     sensor magnético
```

- La **pistola** solo entrega el **texto del QR** (como si lo tecleara).
- El **Ubuntu** valida (firma, vigencia, anti-passback) y **decide**.
- El **DS-K2812** es el "músculo": abre la puerta/pluma y **reporta si está abierta o
  cerrada** (vía su sensor magnético), consultado por **ISAPI**.

---

## 1. La pistola de QR (HID / "teclado")

Las pistolas de código se comportan como un **teclado USB**: leen el QR, **"teclean" el
texto** y mandan un **Enter** al final. No importa el puerto USB.

**Cómo la detecta el Ubuntu:** como un teclado en `/dev/input/by-id/…-kbd` (ruta estable
por modelo, no cambia de puerto). Un servicio lector:
1. Abre ese dispositivo de teclado y lo **"captura" (grab)** para que lo tecleado **no se
   escriba en la consola**.
2. Junta los caracteres hasta el **Enter**.
3. Hace `POST /acceso/dispositivo/validar` con el texto y la **API key** del dispositivo
   (que define su rol entrada/salida, igual que hoy).

**Requisitos de la pistola (configurar una vez con sus hojas de códigos):**
- **Sufijo Enter/CR activado** (que mande Enter al final de cada lectura).
- **Modo HID-Keyboard** (no "serial") y layout **US**.
- Que lea **QR** (no solo códigos de barras 1D).

**Multi-pistola:** una pistola por carril. Un servicio por rol (`acceso-scanner@entrada`,
`acceso-scanner@salida`), cada uno con su ruta `by-id` y su API key, igual que las cámaras.

> Ver el dispositivo: `ls /dev/input/by-id/ | grep -i kbd` con la pistola conectada.

---

## 2. Conectar el Ubuntu ↔ DS-K2812 por red (ISAPI)

### 2.1 Red
- Conecta el **DS-K2812 por Ethernet** a la **misma red** que el Ubuntu.
- Dale **IP fija** al DS-K2812 (o reserva por DHCP). Ej.: `192.168.100.50`.
- Verifica que el Ubuntu lo alcanza: `ping 192.168.100.50`.

### 2.2 Habilitar ISAPI / usuario
- En la web del equipo o en **iVMS-4200**, asegúrate de tener un **usuario** (operador/
  admin) con permiso de control de puertas. ISAPI usa **autenticación Digest**.
- (Si existe la opción) habilita el protocolo **ISAPI/Open Network**.

### 2.3 Probar ISAPI desde el Ubuntu
```bash
# Info del equipo (confirma usuario/clave y que responde ISAPI)
curl -s --digest -u admin:TU_PASS http://192.168.100.50/ISAPI/System/deviceInfo
```

### 2.4 Abrir una puerta (comando confirmado)
```bash
curl -s --digest -u admin:TU_PASS -X PUT \
  http://192.168.100.50/ISAPI/AccessControl/RemoteControl/door/1 \
  -H "Content-Type: application/xml" \
  --data '<RemoteControlDoor><cmd>open</cmd></RemoteControlDoor>'
```
- `door/1` = **puerta 1** del controlador (el DS-K2812 maneja 2 puertas → `door/1` y `door/2`).
- `cmd` puede ser `open` (pulso), `alwaysOpen` (mantener abierta), `alwaysClose`, `close`.

### 2.5 Estado de la puerta ("¿sigue abierta?")
El endpoint de **estado** varía según firmware; hay que confirmarlo en TU equipo. Candidatos:
```bash
curl -s --digest -u admin:TU_PASS "http://192.168.100.50/ISAPI/AccessControl/Door/status?format=json"
# o la capacidad, para ver qué expone:
curl -s --digest -u admin:TU_PASS "http://192.168.100.50/ISAPI/AccessControl/capabilities"
```
> El estado real de "pluma abierta/cerrada" lo da el **sensor magnético** cableado al
> DS-K2812 (ver §3). Si el firmware no expone un estado simple, usamos el **stream de
> eventos** o el **modo simulado** (ver §4). **Esto lo validamos mañana en vivo contra el
> equipo.**

---

## 3. Pinout / cableado del DS-K2812 (etiquetas reales del QSG DS-K281X)

El DS-K2812 es de **2 puertas**. Tiene un **bloque de terminales por puerta** (Lock1 =
Puerta 1, Lock2 = Puerta 2) con **exactamente estas 6 terminales** (así vienen impresas
en la placa):

| Terminal | Qué es | Conexión |
|---|---|---|
| **COM** | Común del relé de la puerta | Común de la cerradura/pluma |
| **NO** | Relé **normalmente abierto** | Cerradura **fail-secure** (electroimán de strike, o entrada "abrir" de la pluma) |
| **NC** | Relé **normalmente cerrado** | Cerradura **fail-safe** (maglock: se suelta al abrir) |
| **S** | **Sensor de puerta** (Door Contact) | Sensor magnético / "pluma arriba" → estado abierta/cerrada |
| **B** | **Botón de salida** (Exit Button / REX) | Botón de apertura local |
| **G** | **GND** (común de `S` y de `B`) | Tierra de sensor y botón |

- El relé de cada puerta usa **COM + (NO o NC)**. NO vs NC se elige con un **jumper**
  (RelayNO/NC) en la placa. Para una **pluma vehicular**, el contacto **NO–COM** va a la
  entrada "abrir" del tablero de la pluma (contacto seco).
- **Lectores:** cada puerta admite lector **RS-485** (`485+`, `485-`, `G`, `12V`) o
  **Wiegand** (`W0`, `W1`, `12V`, `G`, y `OK`/`ERR`/`BEEP`). *En nuestro caso NO usamos
  lector Hikvision:* el QR lo lee la pistola/cámara del Ubuntu; el DS-K2812 solo abre.
- **Alimentación:** `DC_IN (+12V)` / `GND` desde la fuente incluida; `12V_OUT` para
  alimentar cerradura/sensores.
- **Red:** `Network Interface` (RJ45) a la misma LAN que el Ubuntu.

> **Activación obligatoria antes de ISAPI:** de fábrica el equipo viene **inactivo**, IP
> `192.0.0.64`, puerto `8000`, usuario `admin`. Con **SADP** o **iVMS-4200** actívalo
> (crea contraseña fuerte) y cámbiale la IP a tu subred (p. ej. `192.168.100.50`). Hasta
> entonces ISAPI no responde.

### Dónde conectar "algo" para pruebas (sin pluma)
1. **Ver que abre (relé):** multímetro en **continuidad/beep** entre **`COM1` y `NO1`**
   (Puerta 1). Al mandar el `open` por ISAPI, el relé **cierra** y suena durante el tiempo
   de apertura. *Variante visual:* un **foco/LED 12V** en serie por `COM1`–`NO1` (con la
   fuente de 12V) se enciende en cada apertura.
2. **Simular "pluma abierta/cerrada" (sensor):** un **cable puente o un botón entre `S1` y
   `G`**. Cerrado = una posición, abierto = la otra → así pruebas la lógica de **"sigue
   abierta"** (y el estado por ISAPI si el firmware lo reporta).
3. **Abrir local sin software (botón de salida):** un **botón entre `B1` y `G`** abre la
   Puerta 1 directo → verifica el cableado del relé/cerradura sin tocar el software.

> ⚠️ Verifica siempre las etiquetas **impresas en TU placa** antes de energizar. Fuente
> oficial: QSG serie DS-K281X (bloque por puerta: `NC NO S B G COM`).

---

## 4. Lógica en código: "si la pluma sigue abierta…"

Se agrega un **módulo de barrera** en la API con dos backends: **`hikvision`** (ISAPI) y
**`simulado`** (para probar sin equipo). Al autorizar un acceso:

```
¿Autorizado el QR?
      │ sí
      ▼
Leer estado de la puerta (ISAPI / simulado)
      │
      ├── CERRADA  ──► abrir (pulso configurado) ──► conceder, registrar
      │
      └── ABIERTA (de un paso previo / trabada)
                 │
                 ├── esperar cierre hasta BARRERA_TIMEOUT (sondeando)
                 │        ├── cierra a tiempo ──► abrir ──► conceder
                 │        └── sigue abierta al timeout ──► POLÍTICA:
                 │                 • reabrir (mantener abierta) + advertencia, o
                 │                 • negar (posible pluma trabada / tailgating)
```

**Reglas configurables (env):**
- `BARRERA_MODO = hikvision | simulado | ninguno`
- `HIKVISION_URL`, `HIKVISION_USER`, `HIKVISION_PASS`
- `BARRERA_DOOR` por punto (qué puerta del DS-K2812 corresponde a cada punto de acceso)
- `BARRERA_PULSO_SEG` (cuánto queda abierta en un `open`)
- `BARRERA_ESPERA_CIERRE_MS` (cuánto esperamos a que cierre antes de reintentar)
- `BARRERA_POLITICA_ABIERTA = reabrir | esperar | negar`

**Qué registra:** si hubo que **esperar** o **reabrir**, se guarda en el movimiento (y en la
bitácora) para que en el panel se vea "se concedió tras esperar cierre" o "pluma reportada
abierta / posible obstrucción".

> Con `BARRERA_MODO=simulado` puedes probar TODA esta lógica mañana aunque el ISAPI del
> equipo tarde en quedar: el "estado" lo controla una variable/endpoint de prueba.

---

## 5. Plan de pruebas de mañana (checklist)

1. **Red/ISAPI:** `ping` al DS-K2812 y `curl …/ISAPI/System/deviceInfo` responde.
2. **Abrir por ISAPI (manual):** el `curl … RemoteControl/door/1 … open` abre/conmuta el relé.
3. **Estado de puerta:** identificar el endpoint real de estado (o usar el sensor + stream).
4. **Pistola:** conectarla, `ls /dev/input/by-id/ | grep kbd`, designarla a un rol, escanear
   un QR y ver `AUTORIZADO`/`RECHAZADO` en el log y en el panel.
5. **End-to-end:** escanear → autoriza → el DS-K2812 abre → el panel registra.
6. **"Pluma abierta":** dejar el sensor en "abierta" y escanear otro QR → ver que **espera
   el cierre** o **reabre** según la política, y que queda registrado.
7. **Fallback:** si el ISAPI de estado no queda, correr en `BARRERA_MODO=simulado` para
   validar la lógica igualmente.

---

## 6. Qué implementaré en código (para tu visto bueno)

1. **Lector HID (pistola):** `scripts/lector-hid.py` (lee el teclado-pistola por evdev,
   arma el QR hasta Enter y hace el POST) + servicio `acceso-scanner@<rol>` + un
   `designar-scanner.sh` (análogo al de cámaras). Convive con el lector de cámara.
2. **Módulo barrera:** `apps/api/src/barrera/` con `BarreraService` (backends `hikvision`
   por ISAPI con Digest y `simulado`), comandos **abrir** y **estado**, y la **lógica de
   "sigue abierta"** (esperar/reabrir/negar) integrada al validar el acceso.
3. **Config y esquema:** variables de entorno arriba + número de puerta por punto de acceso.
4. **Registro:** marcar en el movimiento si hubo espera/reapertura/obstrucción.

---

### Fuentes (ISAPI Hikvision)
- Comando de apertura `RemoteControl/door` (discusión con ejemplos): https://github.com/Sunoo/homebridge-camera-ffmpeg/discussions/1145
- Add-on Hikvision (documenta cmd open/alwaysOpen y variantes): https://github.com/pergolafabio/Hikvision-Addons/blob/main/doorbell/DOCS.md
- Datasheet DS-K2812 (terminales/pinout y capacidades): https://telesystem.ro/teledbnew/uploads/6572/DS-K2812-Access-Controller_Datasheet_V1.0_20230817.pdf
