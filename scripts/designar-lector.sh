#!/usr/bin/env bash
# Designa (o re-designa) la cámara/tótem a un PUNTO, es decir, su rol.
#
#   PW=dev bash scripts/designar-lector.sh <TIPO> [/dev/videoN]
#
#   TIPO = ENTRADA_VEHICULAR | SALIDA_VEHICULAR | ENTRADA_PEATONAL | SALIDA_PEATONAL
#
# Requiere que ya exista un PUNTO de ese tipo en el parque (se crea en la nube:
# Configuración > Puntos de acceso) y que se haya sincronizado a esta controladora.
set -e
PW="${PW:-dev}"
TIPO="${1:?Falta TIPO: ENTRADA_VEHICULAR | SALIDA_VEHICULAR | ENTRADA_PEATONAL | SALIDA_PEATONAL}"
VIDEO="${2:-/dev/video0}"
ADMIN_EMAIL="${ADMIN_EMAIL:-felipe@thinktech.mx}"
ADMIN_PASS="${ADMIN_PASS:-CambiaEsta#2026}"
API="http://localhost:3001/api"

TOK=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" \
      -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}" \
      | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d).accessToken||"")}catch(e){console.log("")}})')
[ -z "$TOK" ] && { echo "Login fallido (revisa ADMIN_EMAIL/ADMIN_PASS)"; exit 1; }

PUNTO=$(curl -s "$API/puntos" -H "Authorization: Bearer $TOK" \
      | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const a=JSON.parse(d);const t=process.argv[1];const p=a.find(x=>x.tipo===t);console.log(p?p.id:"")}catch(e){console.log("")}})' "$TIPO")
[ -z "$PUNTO" ] && { echo "No hay un punto de tipo $TIPO. Créalo en la nube (Configuración > Puntos de acceso) y espera el sync."; exit 1; }

KEY=$(curl -s -X POST "$API/puntos/$PUNTO/dispositivos" -H "Authorization: Bearer $TOK" \
      -H "Content-Type: application/json" -d "{\"nombre\":\"Camara $TIPO\"}" \
      | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d).apiKey||"")}catch(e){console.log("")}})')
[ -z "$KEY" ] && { echo "No se pudo crear el dispositivo"; exit 1; }

printf "KEY=%s\nVIDEO_DEV=%s\n" "$KEY" "$VIDEO" > ~/.lector.env
chmod 600 ~/.lector.env
echo "$PW" | sudo -S systemctl restart acceso-lector 2>/dev/null
sleep 2
echo "Listo: cámara $VIDEO designada a '$TIPO' (punto $PUNTO). Estado: $(systemctl is-active acceso-lector)"
