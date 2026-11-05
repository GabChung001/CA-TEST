#!/usr/bin/env bash
# Reinicia TODO el sistema de la caseta (botón de pánico).
# Uso:  sudo bash scripts/reiniciar-caseta.sh
#   o:  bash scripts/reiniciar-caseta.sh   (pedirá la contraseña)
set -e
SUDO="sudo"
[ "$(id -u)" = "0" ] && SUDO=""
echo ">> Reiniciando servicios de la caseta..."
$SUDO systemctl restart postgresql
sleep 2
$SUDO systemctl restart acceso-api
sleep 3
$SUDO systemctl restart nginx
$SUDO systemctl restart acceso-lector@entrada acceso-lector@salida
sleep 2
echo ">> Listo. Estado:"
for s in postgresql acceso-api nginx acceso-lector@entrada acceso-lector@salida; do
  printf '   %-26s %s\n' "$s" "$(systemctl is-active "$s" 2>/dev/null)"
done
