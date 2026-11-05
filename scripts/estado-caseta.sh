#!/usr/bin/env bash
# Muestra de un vistazo si la controladora está sana.
# Uso:  bash scripts/estado-caseta.sh
echo "====== ESTADO DE LA CONTROLADORA ======"
for s in postgresql acceso-api nginx acceso-lector@entrada acceso-lector@salida; do
  est=$(systemctl is-active "$s" 2>/dev/null)
  case "$est" in
    active) marca="OK " ;;
    *)      marca="!! " ;;
  esac
  printf '%s %-26s %s\n' "$marca" "$s" "$est"
done
echo "---------------------------------------"
# ¿Responde el panel web (nginx)?
if curl -s -m 4 -o /dev/null -w '%{http_code}' http://localhost/ 2>/dev/null | grep -qE '200|30'; then
  echo "OK  Panel web responde"
else
  echo "!!  Panel web NO responde (revisa nginx)"
fi
echo "Panel web:  http://$(hostname -I 2>/dev/null | awk '{print $1}')"
echo "Cámaras conectadas:"
ls /dev/v4l/by-id/ 2>/dev/null | sed 's/^/   - /' || echo "   (ninguna)"
