#!/usr/bin/env bash
# Plantilla del relé que ABRE LA PLUMA. El lector lo ejecuta en cada acceso
# AUTORIZADO, pasando el rol (entrada/salida) como $1.
#
# Instalar en la controladora Ubuntu:
#   cp scripts/abrir-pluma.example.sh ~/abrir-pluma.sh
#   chmod +x ~/abrir-pluma.sh
#   # edita abajo según tu relé USB y descomenta UNA opción
#
# El relé va cableado al BOTÓN DE SALIDA (B1–G) de la Puerta 1 del DS-K2812
# (contacto seco). Al pulsarlo, el Hik abre la pluma por el tiempo que le
# configures en iVMS (Access Control → Door → tiempo de apertura).
ROL="${1:-entrada}"
PULSO="${PULSO:-1}"   # segundos que el relé queda cerrado (pulso al botón de salida)

logger -t abrir-pluma "Abrir pluma [$ROL] (pulso ${PULSO}s)" 2>/dev/null || true

# ─────────── Elige UNA opción según tu relé USB y descoméntala ───────────

# Opción A) Relé USB tipo HID (chip dcttech) con la herramienta 'usbrelay':
#   sudo apt install -y usbrelay
#   usbrelay                      # lista el ID del relé, p. ej. 959BI_1
# RELE_ID="959BI_1"
# usbrelay ${RELE_ID}=1; sleep "$PULSO"; usbrelay ${RELE_ID}=0
# exit 0

# Opción B) Relé USB serial (chip CH340, /dev/ttyUSB0) con tramas ON/OFF:
# DEV=/dev/ttyUSB0
# stty -F "$DEV" 9600 -echo
# printf '\xA0\x01\x01\xA2' > "$DEV"; sleep "$PULSO"; printf '\xA0\x01\x00\xA1' > "$DEV"
# exit 0

# Por defecto (sin relé aún): solo deja constancia en el log del lector.
echo "[abrir-pluma] (demo) relé no configurado todavía — rol=$ROL"
