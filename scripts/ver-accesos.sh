#!/usr/bin/env bash
# Muestra EN VIVO los accesos de TODAS las camaras (entradas y salidas).
# Cada linea trae la hora, la camara ([entrada]/[salida]) y el resultado
# (AUTORIZADO / RECHAZADO + motivo + nombre).
# Salir: Ctrl + C
echo "Accesos en vivo (todas las camaras). Ctrl+C para salir."
exec sudo journalctl -f -n 30 -o cat -u 'acceso-lector@*'
