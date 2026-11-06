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

## 3. Pinout / cableado del DS-K2812 (aunque mandemos por ISAPI)

Aunque la **orden** de abrir va por red, el DS-K2812 **sigue cableado físicamente** a la
pluma y a su sensor; de ese sensor sale el "está abierta/cerrada" que leeremos por ISAPI.
Por cada puerta, el controlador tiene un bloque de terminales con estos grupos:

| Grupo de terminales | A qué va | Para qué |
|---|---|---|
| **Relé de puerta** (`NO` / `COM` / `NC`) | A la entrada de **abrir** de la pluma (contacto seco) | Abrir la barrera |
| **Sensor de puerta** (`SENSOR`/`DOOR`/`MAG` + `GND`) | Al **sensor de posición de la pluma** (fin de carrera "pluma arriba" o contacto magnético) | Saber si está **abierta/cerrada** |
| **Botón de salida** (`BTN`/`REX` + `GND`) | Botón físico opcional | Apertura manual local |
| **Alimentación** (`+12V` / `GND`) | Fuente del equipo | Energía al sensor/cerradura |

Para **simular la pluma mañana** sin motor:
- Puedes puentear/abrir el **contacto del sensor** a mano para que el controlador vea
  "abierta" o "cerrada" y así probar la lógica de "sigue abierta".
- El **relé de puerta** lo puedes verificar con un **LED/foco de prueba** o un multímetro
  en continuidad (ver que conmute al mandar `open`).

> ⚠️ El **orden exacto y las etiquetas** de las terminales vienen en el **diagrama del
> DS-K2812** (su datasheet/manual). Úsalo para el cableado fino; aquí va el mapa funcional.
> Para una **pluma vehicular** real, el relé va a la entrada de "abrir" del tablero de la
> pluma, y el sensor a un detector de "pluma arriba".

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
