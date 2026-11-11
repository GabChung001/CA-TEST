#!/usr/bin/env bash
# Plantilla del relé que ABRE LAS PLUMAS. El lector lo ejecuta en cada acceso
# AUTORIZADO y le pasa el ROL como $1: 'entrada' o 'salida'.
#
# Cada rol dispara el canal del relé cableado al BOTÓN DE SALIDA de SU puerta:
#   entrada -> canal 1 -> B1–G (Puerta 1 del DS-K2812) -> pluma de ENTRADA
#   salida  -> canal 2 -> B2–G (Puerta 2 del DS-K2812) -> pluma de SALIDA
#
# Instalar en la controladora Ubuntu:
#   cp scripts/abrir-pluma.example.sh ~/abrir-pluma.sh
#   chmod +x ~/abrir-pluma.sh
#   nano ~/abrir-pluma.sh      # descomenta la opción de tu relé USB
ROL="${1:-entrada}"
PULSO="${PULSO:-1}"           # segundos que el relé queda cerrado (pulso al botón de salida)

# Rol -> canal del relé (1=entrada, 2=salida)
case "$ROL" in
  entrada*) CH=1 ;;
  salida*)  CH=2 ;;
  *)        CH=1 ;;
esac

logger -t abrir-pluma "Abrir pluma [$ROL] canal=$CH (pulso ${PULSO}s)" 2>/dev/null || true

# ─────────── Elige UNA opción según tu relé USB de 2 canales y descoméntala ───────────

# Opción A) Relé USB HID (chip dcttech) de 2 canales, con 'usbrelay':
#   sudo apt install -y usbrelay
#   usbrelay                       # lista los IDs, p. ej. 959BI_1 y 959BI_2
# RELE_ID="959BI_${CH}"
# usbrelay ${RELE_ID}=1; sleep "$PULSO"; usbrelay ${RELE_ID}=0
# exit 0

# Opción B) Relé USB serial (chip CH340) de 2 canales en /dev/ttyUSB0:
#   Canal 1: ON A0 01 01 A2 / OFF A0 01 00 A1 ; Canal 2: ON A0 02 01 A3 / OFF A0 02 00 A2
# DEV=/dev/ttyUSB0
# stty -F "$DEV" 9600 -echo
# if [ "$CH" = "1" ]; then ON=$'\xA0\x01\x01\xA2'; OFF=$'\xA0\x01\x00\xA1';
#                     else ON=$'\xA0\x02\x01\xA3'; OFF=$'\xA0\x02\x00\xA2'; fi
# printf '%b' "$ON" > "$DEV"; sleep "$PULSO"; printf '%b' "$OFF" > "$DEV"
# exit 0

# Por defecto (sin relé aún): solo deja constancia en el log del lector.
echo "[abrir-pluma] (demo) relé no configurado — rol=$ROL canal=$CH"
