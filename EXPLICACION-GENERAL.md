# Explicación general — Control de Accesos ThinkTech

Documento maestro que explica **todo** lo construido: qué es, cómo funciona, cómo se
lee y descifra el QR, la arquitectura nube + caseta, la seguridad, cómo se despliega,
cómo encaja el hardware (Hikvision DS-K2812) y cómo trabajar en un solo equipo de
desarrollo. Pensado para entenderlo de principio a fin sin ser programador.

---

## 1. Qué es el sistema

Una plataforma de **control de acceso vehicular y peatonal para parques industriales**.
Cada **bodega** da de alta a su personal y genera un **QR por persona**. En las casetas,
unas **cámaras (tótems)** leen ese QR y el sistema decide **autorizar o rechazar** la
entrada/salida, aplicando reglas como **anti-passback** (no puedes volver a entrar si no
has marcado salida) y **reset de presencia cada 24 h**. Todo queda registrado y visible
en un **panel en tiempo real**, y se **sincroniza a la nube** para administración central
de varios parques.

---

## 2. Arquitectura: nube + caseta (todo-en-uno)

Hay **dos piezas**, cada una es un "todo-en-uno" (API + web + base de datos en una sola
máquina):

```
   ┌─────────────────────────────┐          ┌──────────────────────────────────┐
   │        NUBE (AWS)           │   sync   │     CONTROLADORA (caseta/edge)    │
   │  SYNC_ROLE=cloud            │◄────────►│     SYNC_ROLE=edge                │
   │                             │          │                                  │
   │  • Altas de personal y QR   │  catálogo│  • Valida QR localmente (rápido  │
   │  • Administración central   │  ───────►│    y SIN depender de internet)   │
   │  • Reportes de varios       │          │  • Cámaras (tótems) leen QR      │
   │    parques                  │ movimien.│  • Registra entradas/salidas     │
   │  • Panel y configuración    │◄──────── │  • Anti-passback + reset 24h     │
   └─────────────────────────────┘          └──────────────────────────────────┘
          Internet público                      Red local de la caseta
```

- **La nube** es el "cerebro administrativo": ahí se crean bodegas, personas y QR, y se
  ven reportes de todos los parques.
- **La controladora** es el "cerebro operativo" de cada caseta: valida los accesos al
  instante, **funciona aunque se caiga el internet**, y luego sincroniza.
- Cada controladora está **acotada a un parque** (`PARQUE_ID`): solo recibe el catálogo
  de su parque.

**¿Por qué así?** Porque la caseta no puede depender de internet para abrir una pluma: si
se cae la red, la gente se queda afuera. La controladora local resuelve en milisegundos y
offline; la nube centraliza la administración.

---

## 3. El QR: cómo se genera y por qué es seguro

El QR **no** guarda datos personales ni una URL. Guarda un texto corto **firmado**:

```
TTA1.<codigo>.<firma>
   │     │        └── firma HMAC-SHA256 (prueba de que es legítimo)
   │     └── código único de la credencial
   └── prefijo/versión del formato
```

- Al crear una credencial, el servidor genera un `codigo` único y calcula una **firma
  HMAC-SHA256** usando un secreto (`QR_SIGNING_SECRET`) que **solo** conocen el servidor
  de la nube y las controladoras.
- El QR es **estático**: el mismo texto sirve impreso/enmicado o mostrado en la pantalla
  del celular. No cambia, no caduca por tiempo (salvo que le pongas vigencia), y funciona
  sin internet en la caseta.
- **Por qué es seguro:** aunque alguien copie el formato, **no puede fabricar la firma**
  sin el secreto. Si el QR viene alterado o inventado, la firma no cuadra y se rechaza
  (`FIRMA_INVALIDA`). El secreto nunca viaja en el QR.

> Importante: el `QR_SIGNING_SECRET` debe ser **el mismo** en la nube y en cada
> controladora, o los QR de la nube no validarían en la caseta.

---

## 4. Cómo la cámara **lee y descifra** el QR (tu duda)

Hay dos formas de leer un QR, y es clave no confundirlas:

### A. Lector QR dedicado tipo "teclado" (HID / keyboard-wedge)
Es lo que te describieron: un aparato con su **propia cámara y chip decodificador**.
Decodifica el QR **adentro del aparato** y "escribe" el texto resultante como si fuera un
**teclado**, terminando con un **Enter**. El equipo al que está conectado solo recibe el
texto ya descifrado (p. ej. en un campo de formulario enfocado). Cómodo, pero es una
**caja cerrada**: tú no controlas el proceso, y normalmente lee QR "en claro".

### B. Nuestra forma (todo-en-uno con webcam)
Usamos una **cámara web común** y el software hace la decodificación nosotros mismos:

1. La **webcam** entrega las imágenes (cuadros de video) por USB.
2. El programa **`zbarcam`** (librería de visión `zbar`) analiza cada cuadro, **encuentra**
   el patrón del QR y lo **decodifica a texto**: `TTA1.<codigo>.<firma>`. (Esto es "descifrar"
   en el sentido de *decodificar la imagen a su texto*; el QR es un formato de imagen, no un
   cifrado.)
3. Nuestro script [`lector.sh`](scripts/lector.sh) toma ese texto y lo **envía a la API
   local** por HTTP: `POST /acceso/dispositivo/validar` con el texto del QR y la **API key**
   del dispositivo (que identifica qué cámara es y, por lo tanto, su **rol** entrada/salida).
4. La **API valida la firma HMAC** (esto sí es criptografía): si la firma es correcta y la
   credencial está vigente y no viola el anti-passback → **AUTORIZADO**; si no → **RECHAZADO**
   con el motivo. La respuesta incluye `abrirBarrera: true/false`.
5. El lector, si fue autorizado, imprime `>>> PLUMA/BARRERA ABIERTA` y ejecuta el hook
   `~/abrir-pluma.sh` (para accionar un relé/pluma; ver §10).

**Diferencia clave:** el lector tipo teclado te da el texto y ya; **nosotros** controlamos
todo el pipeline (qué cámara, qué rol, validación de firma, anti-passback, registro,
apertura). Ambos terminan con el **mismo texto decodificado**; la diferencia es **quién
decodifica y quién decide**. En nuestro caso, **decide nuestro servidor** con su firma y
reglas, no una caja cerrada.

> En ambos casos el "cerebro" de la decisión es la **controladora/servidor**, no la cámara.
> La cámara solo aporta el texto del QR.

---

## 5. Flujo de una lectura (paso a paso)

1. La persona muestra su QR a la cámara (entrada o salida).
2. La cámara decodifica → el lector manda el texto a la API con la API key del dispositivo.
3. La API:
   - Verifica la **firma** del QR. ❌ → `FIRMA_INVALIDA` / `QR_NO_RECONOCIDO`.
   - Busca la **credencial** por su código. ❌ → `QR_NO_RECONOCIDO`.
   - Revisa **estado y vigencia** (bloqueada, revocada, vencida). ❌ → motivo correspondiente.
   - Revisa **tipo** (vehicular vs peatonal según el punto). ❌ → `TIPO_INCORRECTO`.
   - **Anti-passback** (solo en entrada): si ya está ADENTRO → `REINGRESO_NO_PERMITIDO`.
   - ✅ Si todo pasa: marca presencia (ADENTRO en entrada / AFUERA en salida) y registra el
     movimiento como **AUTORIZADO**; responde `abrirBarrera: true`.
4. Todo movimiento (autorizado o rechazado) **se registra** con una "foto" (snapshot) del
   nombre, bodega y placas, y **se sincroniza a la nube**.

**Reset de 24 h:** una tarea programada pone en AFUERA a quien lleve >24 h marcado ADENTRO
sin haber salido (evita que se quede "atorado" dentro para siempre).

---

## 6. Roles y permisos

| Rol | Qué puede hacer |
|---|---|
| **SUPER_ADMIN** (ThinkTech) | Todo; elige parque→bodega; crea parques, puntos y dispositivos |
| **ADMIN_PARQUE** | Administra su parque: bodegas, puntos, personal, reportes |
| **ADMIN_BODEGA** | Solo su(s) bodega(s): su personal y sus QR, su asistencia |
| **VIGILANCIA** | Panel de caseta en vivo: nombre, acceso, hora, bodega |

El acceso está acotado por **parque/bodega** en cada consulta (un admin de bodega nunca ve
datos de otra bodega).

---

## 7. Sincronización nube ↔ caseta

- **Bajada (catálogo):** la controladora pide a la nube su catálogo (parques, bodegas,
  personas, credenciales, puntos, dispositivos) acotado a su `PARQUE_ID`, y lo refleja
  localmente. Así valida offline. La **presencia** (ADENTRO/AFUERA) es local y no se pisa.
- **Subida (movimientos):** la controladora sube los accesos registrados. Es **idempotente**
  (no duplica) y **tolerante a fallos**: si se cae el internet, se acumulan y suben después.
- **Push inmediato:** además del ciclo periódico, la controladora **empuja ~1 s después**
  de cada acceso, para que la nube lo vea casi al instante.
- **Tolerancia a llaves foráneas:** la nube ignora referencias que no existen en ella (p. ej.
  dispositivos locales de la caseta) en vez de rechazar todo el lote. El dato legible viaja
  en el snapshot, así que no se pierde.

---

## 8. La controladora de caseta (operación)

Servicios (arrancan solos al prender la máquina — sobreviven cortes de luz):

| Servicio | Función |
|---|---|
| `acceso-api` | Valida accesos, anti-passback, sincroniza |
| `nginx` | Sirve el panel web (puerto 80) |
| `acceso-lector@<rol>` | Una **cámara por rol** (entrada, salida, …) leyendo QR |
| `postgresql` | Base de datos local |

- **Multi-cámara:** una instancia de lector por cámara (`acceso-lector@entrada`,
  `acceso-lector@salida`), cada una ligada a su `/dev/video…` (por ruta **estable** `by-id`,
  que no cambia aunque se reordenen los USB) y a un **punto de acceso** (que define su rol).
- Guías operativas: [OPERACION-CASETA.md](OPERACION-CASETA.md),
  [CONTROLADORA-CASETA.md](CONTROLADORA-CASETA.md),
  [GUIA-CLIENTE-CASETA.md](GUIA-CLIENTE-CASETA.md).

---

## 9. El panel web

- **Panel de vigilancia:** accesos de hoy, rechazos, **personas dentro ahora** (lista con
  nombre, bodega, tipo, placas, hora de entrada), gráfica de 7 días y últimos movimientos.
  Se **auto-refresca cada 3 s**.
- **Personal:** altas/bajas, generar QR, descargar o compartir por WhatsApp.
- **Bodegas / Usuarios / Historial.**
- **Configuración:** parques, **puntos de acceso** y **dispositivos** (ver la API key por
  dispositivo, regenerarla o revocarla), y **MFA**.

---

## 10. Hardware físico y la controladora Hikvision DS-K2812

### Qué es el DS-K2812
Es una **controladora de acceso de red para 2 puertas** (RS-485, uplink TCP/IP; admite
hasta 4 lectores Wiegand y 4 RS-485; ~10,000 usuarios y 50,000 eventos; con anti-passback
propio, operación offline y comunicación cifrada; se configura con iVMS-4200).
**No trae lector de QR**: en el esquema Hikvision, el QR lo pone una **terminal aparte**
(p. ej. DS-K1T502DBWX-CQR) que manda el resultado a la controladora por **Wiegand**.

### Dos filosofías (no mezclar a ciegas)
- **Nuestro sistema** usa un QR **firmado por nosotros**, validado por **nuestro** servidor,
  con **nuestro** anti-passback, panel y nube multi-parque.
- **Hikvision** administra sus **propios** usuarios/tarjetas y su plataforma; su QR lo valida
  **su** terminal, no el nuestro.

Si quieres conservar lo que construimos (QR firmado, anti-passback, panel, nube), lo mejor
es usar el **DS-K2812 como el "músculo" que abre la puerta/pluma**, y dejar la **decisión**
en nuestra controladora. Tres caminos, de más simple a más integrado:

1. **Relé a la entrada de "botón de salida" (lo más simple y a prueba de todo).**
   Nuestra controladora, al autorizar, cierra un relé (USB) conectado a la entrada
   de **exit button / request-to-exit** del DS-K2812 (o directo a la cerradura por el relé de
   puerta del Hikvision). El DS-K2812 abre esa puerta. No depende de API ni firmware; es el
   hook `abrir-pluma.sh` que ya dejamos, ahora disparando al Hikvision.
2. **ISAPI (abrir puerta por red), si el firmware lo soporta.**
   Muchas controladoras Hikvision exponen **ISAPI** (HTTP) para "abrir puerta N" de forma
   remota. Nuestra controladora, al autorizar, haría una petición HTTP al DS-K2812 para abrir.
   Más limpio (sin cablear el disparo), pero **hay que confirmar en el datasheet/firmware del
   DS-K2812** que trae ISAPI y con qué credenciales (no todos los modelos de esta serie lo
   documentan).
3. **Inyección Wiegand (lo más "Hikvision").**
   Un pequeño conversor enviaría al DS-K2812 un número Wiegand "válido" tras nuestra
   autorización. Implica duplicar el enrolamiento en el Hikvision; **no lo recomiendo** para
   nuestro caso.

**Recomendación:** empezar por el **camino 1** (relé → botón de salida) para una prueba
física inmediata y confiable, y evaluar el **camino 2 (ISAPI)** una vez confirmado el
firmware. Cuando tengas el equipo en mano te preparo el `abrir-pluma.sh` con el pulso y el
cableado exactos.

> Nota: el DS-K2812 aporta además cosas útiles de instalación física: relés de puerta,
> sensores (puerta abierta/forzada), botón de salida, alimentación de cerraduras y gabinete.
> Aunque la **lógica** siga en nuestro sistema, el Hikvision puede ser el herraje eléctrico.

---

## 11. Ambiente de desarrollo: pasar a **una sola máquina**

Hoy hay dos piezas para pruebas: **AWS (nube)** y una **VM Ubuntu en una laptop** (la
controladora de pruebas, `192.168.100.63`). Para desarrollar puedes **consolidar**.

Opciones (elige una; te la dejo montada):

- **A. Una sola máquina "todo-en-uno" de desarrollo (recomendado para programar).**
  Un solo equipo con `SYNC_ROLE=cloud`, su Postgres, la API, la web y la cámara apuntando a
  **esa misma** API local. Sin edge ni sync: más simple para desarrollar y probar la lógica.
  La VM de pruebas se **apaga/retira**.
- **B. Mantener nube (AWS) + una sola controladora.**
  Dejas AWS como nube y **una** máquina como caseta (la que será la definitiva). Es lo más
  parecido a producción.
- **C. Simular las dos piezas en tu PC con contenedores.**
  Nube y edge como dos contenedores en tu máquina de desarrollo. Útil para probar el sync sin
  depender de AWS ni de la VM.

**Para "quitar" la VM de pruebas** (cuando decidas): se detienen y deshabilitan sus
servicios (`acceso-api`, `acceso-lector@*`, `nginx`) o simplemente se apaga la VM; nada en la
nube se ve afectado. Si prefieres reutilizar esa laptop como la **máquina única de
desarrollo**, la reconfiguramos a `SYNC_ROLE=cloud` y listo.

> Dime cuál (A, B o C) y lo dejo configurado paso a paso.

---

## 12. Seguridad (SGSI)

- **Sin PHP** (se evitó por su historial de vulnerabilidades); stack moderno TypeScript.
- **Contraseñas** con `argon2` (hash fuerte), **JWT** de acceso+refresh, **MFA (TOTP)**,
  bloqueo por intentos.
- **RBAC** (control por rol) + **acotamiento por parque/bodega** en cada consulta.
- **QR firmado** (HMAC-SHA256): imposible fabricar uno válido sin el secreto.
- **Dispositivos** (cámaras) autenticados con **API key** propia (hash en BD; el secreto se
  muestra una sola vez; se puede **regenerar/revocar**).
- **Sync** autenticado con clave (`EDGE_SYNC_KEY`) y **comunicación de la caseta encriptada**.
- **Operación offline**: la caseta no se cae si se cae el internet.

---

## 13. Despliegue y actualización

- Código en GitHub (**repo público**): `GabChung001/CA-TEST`.
- **Flujo:** programar → `git push` → en el servidor `bash scripts/deploy.sh` (trae cambios,
  compila API+web, publica, reinicia). El `.env` nunca se toca.
- Guía detallada de la nube: [DESPLIEGUE-AWS.md](DESPLIEGUE-AWS.md).
- Guía de la caseta: [CONTROLADORA-CASETA.md](CONTROLADORA-CASETA.md).

---

## 14. Glosario rápido

- **Controladora / edge:** la computadora de la caseta que valida accesos localmente.
- **Nube / cloud:** el servidor central (AWS) de administración y reportes.
- **Punto de acceso:** una entrada o salida (vehicular/peatonal). Define el **rol** de la cámara.
- **Dispositivo:** una cámara/tótem registrada en un punto; tiene su API key.
- **Credencial:** el QR de una persona (o vehículo).
- **Anti-passback:** no re-entrar sin haber salido.
- **Snapshot:** copia del nombre/bodega/placas guardada con cada movimiento.
- **ISAPI:** API HTTP de Hikvision para integrar/controlar sus equipos.
- **Wiegand:** protocolo clásico entre lectores y controladoras de acceso.

---

### Fuentes sobre el hardware Hikvision
- Datasheet DS-K2812 (telesystem.ro): https://telesystem.ro/teledbnew/uploads/6572/DS-K2812-Access-Controller_Datasheet_V1.0_20230817.pdf
- Ficha DS-K2812 (Cyberpuerta, "2 puertas, hasta 10,000 usuarios"): https://www.cyberpuerta.mx/Seguridad-y-Vigilancia/Control-de-Acceso/Paneles-Control-de-Acceso/Paneles-Controladores/Hikvision-Panel-de-Control-de-Acceso-DS-K2812-RS-485-para-2-Puertas-hasta-10-000-Usuarios.html
- Terminal QR Hikvision que alimenta a una controladora por Wiegand (DS-K1T502DBWX-CQR): https://www.adk-security.com/products/hikvision-ip-standalone-intercom-access-keypad-prox-qr-code-terminal-12v-ds-k1t502dbwx-cqr
