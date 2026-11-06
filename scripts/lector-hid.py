#!/usr/bin/env python3
"""
Lector de QR por PISTOLA HID (tipo teclado).
La pistola "teclea" el contenido del QR y manda Enter. Este script abre el
dispositivo de teclado de la pistola, lo CAPTURA (grab) para que no escriba en la
consola, arma el texto hasta el Enter y lo valida contra la API local.

Variables (del EnvironmentFile ~/.scanner-<rol>.env):
  SCANNER_DEV  ruta estable del teclado-pistola, p. ej.
               /dev/input/by-id/usb-XXXX_Barcode_Scanner-event-kbd
  KEY          API key del dispositivo (define el rol entrada/salida)
  API          base de la API (default http://localhost:3001/api)
  ROL          etiqueta para el log (entrada/salida)

Requisitos en el Ubuntu:  sudo apt install -y python3-evdev
"""
import os
import sys
import json
import urllib.request

try:
    from evdev import InputDevice, categorize, ecodes
except Exception:
    sys.stderr.write("Falta python3-evdev: sudo apt install -y python3-evdev\n")
    sys.exit(1)

API = os.environ.get("API", "http://localhost:3001/api")
KEY = os.environ.get("KEY", "")
ROL = os.environ.get("ROL", "scanner")
DEV = os.environ.get("SCANNER_DEV", "")

# Mapa de teclas -> carácter (normal, con Shift). Cubre lo que usa el QR firmado:
# TTA1, letras, dígitos, '.', '-', '_'.
BASE = {
    'KEY_1': ('1', '!'), 'KEY_2': ('2', '@'), 'KEY_3': ('3', '#'), 'KEY_4': ('4', '$'),
    'KEY_5': ('5', '%'), 'KEY_6': ('6', '^'), 'KEY_7': ('7', '&'), 'KEY_8': ('8', '*'),
    'KEY_9': ('9', '('), 'KEY_0': ('0', ')'),
    'KEY_MINUS': ('-', '_'), 'KEY_EQUAL': ('=', '+'),
    'KEY_DOT': ('.', '>'), 'KEY_COMMA': (',', '<'), 'KEY_SLASH': ('/', '?'),
    'KEY_SEMICOLON': (';', ':'), 'KEY_APOSTROPHE': ("'", '"'),
    'KEY_LEFTBRACE': ('[', '{'), 'KEY_RIGHTBRACE': (']', '}'), 'KEY_BACKSLASH': ('\\', '|'),
    'KEY_SPACE': (' ', ' '),
}
for c in "abcdefghijklmnopqrstuvwxyz":
    BASE['KEY_' + c.upper()] = (c, c.upper())


def validar(qr: str):
    data = json.dumps({"qr": qr}).encode()
    req = urllib.request.Request(
        f"{API}/acceso/dispositivo/validar",
        data=data,
        headers={"x-api-key": KEY, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            res = json.loads(r.read().decode())
    except Exception as e:
        print(f"[{ROL}] error API: {e}", flush=True)
        return
    p = res.get("persona") or {}
    quien = " ".join(x for x in [p.get("nombre"),
                                 f"— {p.get('bodega')}" if p.get("bodega") else "",
                                 f"[{p.get('placas')}]" if p.get("placas") else ""] if x)
    extra = f" ({res.get('motivo')})" if res.get("motivo") else ""
    print(f"[{ROL}] {res.get('resultado')}{extra} {quien}".rstrip(), flush=True)
    if res.get("abrirBarrera"):
        det = (res.get("barrera") or {}).get("detalle", "")
        print(f"        >>> PLUMA/BARRERA ABIERTA [{ROL}]" + (f" — {det}" if det else ""), flush=True)
        hook = os.path.expanduser("~/abrir-pluma.sh")
        if os.access(hook, os.X_OK):
            os.system(f'"{hook}" "{ROL}" &')


def main():
    if not DEV or not KEY:
        sys.stderr.write("Faltan SCANNER_DEV o KEY en el entorno\n")
        sys.exit(1)
    dev = InputDevice(DEV)
    dev.grab()  # evita que lo tecleado llegue a la consola
    print(f"Lector HID [{ROL}] iniciado en {DEV} ({dev.name})", flush=True)
    shift = False
    buf = []
    for ev in dev.read_loop():
        if ev.type != ecodes.EV_KEY:
            continue
        k = categorize(ev)
        name = ecodes.KEY[ev.code] if ev.code in ecodes.KEY else ""
        if name in ("KEY_LEFTSHIFT", "KEY_RIGHTSHIFT"):
            shift = ev.value != 0  # 1=press,2=hold,0=release
            continue
        if ev.value != 1:  # solo key-down
            continue
        if name in ("KEY_ENTER", "KEY_KPENTER"):
            if buf:
                validar("".join(buf))
                buf = []
            continue
        pair = BASE.get(name)
        if pair:
            buf.append(pair[1] if shift else pair[0])


if __name__ == "__main__":
    main()
