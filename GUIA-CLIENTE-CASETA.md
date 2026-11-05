# Guía rápida de la caseta (controladora)

Esta guía es para el personal de la caseta. Explica qué hacer **si se va la luz**,
cómo **encender el sistema** y qué revisar si algo no funciona. No necesitas saber
de programación: son pasos de copiar y pegar.

> La controladora es la computadora (Linux) de la caseta. A ella se conectan las
> cámaras que leen los QR de entrada y salida.

---

## 1. ¿Se fue la luz y volvió? → No tienes que hacer casi nada

El sistema está configurado para **arrancar solo** cuando la computadora se enciende.

1. Verifica que la **computadora esté encendida** (si no, préndela con su botón).
2. Verifica que las **cámaras estén conectadas** a sus mismos puertos USB.
3. **Espera 2 minutos.** El sistema levanta solo la base de datos, el panel y los
   lectores de las cámaras.
4. Abre el **panel** en el navegador: **http://IP-DE-LA-CASETA**
   (tu instalador te dejó la dirección; por lo general `http://192.168.100.63`).

Si ves el panel y puedes iniciar sesión, **ya está funcionando**. Haz una prueba:
muestra un QR a la cámara de entrada y revisa que aparezca el acceso.

> **Importante:** no cambies las cámaras de puerto USB. El sistema reconoce cada
> cámara por su modelo, así que aunque se reinicie seguirán funcionando entrada y
> salida correctamente, siempre que sigan conectadas.

---

## 2. Si el panel no abre o una cámara no lee

Abre una terminal en la computadora de la caseta y corre **un solo comando** para
ver el estado:

```bash
cd ~/Control-de-Accesos && bash scripts/estado-caseta.sh
```

Verás algo así (lo sano dice `OK` y `active`):

```
OK  postgresql                 active
OK  acceso-api                 active
OK  nginx                      active
OK  acceso-lector@entrada      active
OK  acceso-lector@salida       active
```

- Si **todo dice `active`** pero el panel no cargaba, recarga el navegador con
  **Ctrl + Shift + R**.
- Si **algo dice `!!` / no `active`**, reinicia todo el sistema con un comando:

```bash
cd ~/Control-de-Accesos && bash scripts/reiniciar-caseta.sh
```

(Te pedirá la contraseña del equipo.) Espera a que termine y vuelve a abrir el panel.

---

## 3. Ver TODOS los accesos en vivo (entradas y salidas)

Para ver en tiempo real lo que leen **todas las cámaras a la vez** (entrada y salida),
un solo comando:

```bash
cd ~/Control-de-Accesos && bash scripts/ver-accesos.sh
```

Cada línea muestra la hora, la cámara (`[entrada]` / `[salida]`) y el resultado:

```
22:31:04 [entrada] AUTORIZADO Juan Pérez — Bodega 12 [ABC-123]
22:31:40 [entrada] RECHAZADO (REINGRESO_NO_PERMITIDO) Juan Pérez — Bodega 12
22:33:10 [salida]  AUTORIZADO Juan Pérez — Bodega 12
```

Ciérralo con **Ctrl + C**. (También está el historial completo en el panel web,
en *Historial de accesos*.)

---

## 4. Si una cámara dejó de leer

1. Revisa que la cámara esté **bien conectada** (desconéctala y vuelve a conectarla).
2. Mira las cámaras que la computadora reconoce:

```bash
bash scripts/estado-caseta.sh
```

   En "Cámaras conectadas" deben aparecer las tuyas (por ejemplo la `HD_Pro_Webcam_C920`).
3. Reinicia solo los lectores:

```bash
sudo systemctl restart acceso-lector@entrada acceso-lector@salida
```

4. Para ver en vivo lo que lee **una** cámara específica:

```bash
sudo journalctl -u acceso-lector@entrada -f
```

   (Para ver **todas** a la vez, usa `bash scripts/ver-accesos.sh` — sección 3.
   Ciérralo con **Ctrl + C**.)

---

## 5. Si moviste o cambiaste una cámara de lugar

Si conectaste una cámara nueva o la cambiaste de puerto, hay que **volver a indicarle
su rol** (entrada o salida). Un comando por cámara:

```bash
cd ~/Control-de-Accesos
# ver el nombre exacto de las cámaras conectadas
ls /dev/v4l/by-id/
# asignar (ejemplo): salida = Logitech C920
PW=dev bash scripts/designar-lector.sh salida /dev/v4l/by-id/usb-046d_HD_Pro_Webcam_C920-video-index0 SALIDA_VEHICULAR
```

El detalle completo de roles (entrada/salida, vehicular/peatonal) está en
**OPERACION-CASETA.md**.

---

## 6. ¿Internet caído? El sistema sigue trabajando

La caseta **funciona sin internet**: valida los QR localmente y guarda todos los
accesos. Cuando vuelve el internet, **sube solo** los registros a la nube. No pierdes
ningún movimiento.

---

## 7. Resumen de un vistazo

| Situación | Qué hacer |
|---|---|
| Se fue y volvió la luz | Enciende la PC, espera 2 min, abre el panel |
| El panel no carga | `Ctrl+Shift+R`; si sigue, `bash scripts/reiniciar-caseta.sh` |
| Ver accesos en vivo (todas) | `bash scripts/ver-accesos.sh` |
| Una cámara no lee | Reconéctala y `sudo systemctl restart acceso-lector@entrada acceso-lector@salida` |
| Ver estado general | `bash scripts/estado-caseta.sh` |
| Reiniciar todo | `bash scripts/reiniciar-caseta.sh` |

**Soporte ThinkTech:** si tras reiniciar sigue sin funcionar, contacta a tu proveedor
con una foto de lo que muestra `estado-caseta.sh`.
