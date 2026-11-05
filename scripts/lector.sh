#!/usr/bin/env bash
# Lector de QR por cámara (tótem). Toma KEY y VIDEO_DEV del EnvironmentFile
# del servicio (~/.lector.env). El PUNTO (rol entrada/salida) lo determina el
# dispositivo dueño de esa KEY.
API="${API:-http://localhost:3001/api}"
VIDEO_DEV="${VIDEO_DEV:-/dev/video0}"
last=""; lastt=0
echo "Lector QR iniciado ($VIDEO_DEV)"
zbarcam --nodisplay --raw "$VIDEO_DEV" 2>/dev/null | while IFS= read -r qr; do
  [ -z "$qr" ] && continue
  now=$(date +%s)
  # Evita reprocesar el mismo QR en 5 s.
  if [ "$qr" = "$last" ] && [ $((now - lastt)) -lt 5 ]; then continue; fi
  last="$qr"; lastt=$now
  res=$(curl -s -X POST "$API/acceso/dispositivo/validar" \
        -H "x-api-key: $KEY" -H "Content-Type: application/json" \
        -d "{\"qr\":\"$qr\"}")
  echo "$(date +%T) -> $res"
done
