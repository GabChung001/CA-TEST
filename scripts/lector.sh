#!/usr/bin/env bash
# Lector de QR por cámara (tótem). Toma KEY y VIDEO_DEV del EnvironmentFile
# del servicio (~/.lector-<rol>.env). El PUNTO (rol entrada/salida) lo determina
# el dispositivo dueño de esa KEY.
API="${API:-http://localhost:3001/api}"
VIDEO_DEV="${VIDEO_DEV:-/dev/video0}"
ROL="${ROL:-lector}"
last=""; lastt=0
echo "Lector QR [$ROL] iniciado en $VIDEO_DEV"
zbarcam --nodisplay --raw "$VIDEO_DEV" 2>/dev/null | while IFS= read -r qr; do
  [ -z "$qr" ] && continue
  now=$(date +%s)
  # Evita reprocesar el mismo QR en 5 s en esta misma cámara.
  if [ "$qr" = "$last" ] && [ $((now - lastt)) -lt 5 ]; then continue; fi
  last="$qr"; lastt=$now
  res=$(curl -s -X POST "$API/acceso/dispositivo/validar" \
        -H "x-api-key: $KEY" -H "Content-Type: application/json" \
        -d "{\"qr\":\"$qr\"}")
  # Log legible: RESULTADO (MOTIVO) nombre — bodega
  linea=$(printf '%s' "$res" | node -e '
    let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
      try{const r=JSON.parse(d);
        const p=r.persona||{};
        const quien=[p.nombre,p.bodega?("— "+p.bodega):"",p.placas?("["+p.placas+"]"):""].filter(Boolean).join(" ");
        const extra=r.motivo?(" ("+r.motivo+")"):"";
        console.log(`${r.resultado}${extra} ${quien}`.trim());
      }catch(e){console.log("sin respuesta: "+d.slice(0,120));}
    });')
  echo "$(date +%T) [$ROL] $linea"
done
