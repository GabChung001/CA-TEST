#!/usr/bin/env bash
# Designa una cámara/tótem a un rol (entrada/salida) como un servicio propio.
# Cada cámara = una instancia: acceso-lector@<NOMBRE>.
#
#   PW=dev bash scripts/designar-lector.sh <NOMBRE> <VIDEO> <TIPO|KEY>
#
#   NOMBRE = etiqueta de la instancia (entrada, salida, entrada-peatonal, ...)
#   VIDEO  = /dev/videoN de esa cámara
#   TIPO   = ENTRADA_VEHICULAR | SALIDA_VEHICULAR | ENTRADA_PEATONAL | SALIDA_PEATONAL
#            -> crea el dispositivo localmente y obtiene su KEY.
#   KEY    = si ya creaste el dispositivo en la nube, pega aquí su apiKey
#            (formato <id>.<secreto>) en lugar del TIPO.
#
# Ejemplos:
#   bash scripts/designar-lector.sh entrada /dev/video0 ENTRADA_VEHICULAR
#   bash scripts/designar-lector.sh salida  /dev/video4 cmw4...q.ZnkelEbI-...
set -e
PW="${PW:-dev}"
NOMBRE="${1:?Falta NOMBRE (ej. entrada, salida)}"
VIDEO="${2:?Falta VIDEO (ej. /dev/video0)}"
TIPO_O_KEY="${3:?Falta TIPO (ENTRADA_VEHICULAR...) o KEY (<id>.<secreto>)}"
ADMIN_EMAIL="${ADMIN_EMAIL:-felipe@thinktech.mx}"
ADMIN_PASS="${ADMIN_PASS:-CambiaEsta#2026}"
API="http://localhost:3001/api"
REPO="$(cd "$(dirname "$0")/.." && pwd)"

# ¿Es una KEY (trae un punto '.') o un TIPO?
if printf '%s' "$TIPO_O_KEY" | grep -q '\.'; then
  KEY="$TIPO_O_KEY"
else
  TIPO="$TIPO_O_KEY"
  TOK=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" \
        -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}" \
        | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d).accessToken||"")}catch(e){console.log("")}})')
  [ -z "$TOK" ] && { echo "Login fallido (revisa ADMIN_EMAIL/ADMIN_PASS)"; exit 1; }
  PUNTO=$(curl -s "$API/puntos" -H "Authorization: Bearer $TOK" \
        | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const a=JSON.parse(d);const t=process.argv[1];const p=a.find(x=>x.tipo===t);console.log(p?p.id:"")}catch(e){console.log("")}})' "$TIPO")
  [ -z "$PUNTO" ] && { echo "No hay un punto de tipo $TIPO. Créalo en la nube (Configuración > Puntos de acceso) y espera el sync."; exit 1; }
  KEY=$(curl -s -X POST "$API/puntos/$PUNTO/dispositivos" -H "Authorization: Bearer $TOK" \
        -H "Content-Type: application/json" -d "{\"nombre\":\"Camara $NOMBRE\"}" \
        | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d).apiKey||"")}catch(e){console.log("")}})')
  [ -z "$KEY" ] && { echo "No se pudo crear el dispositivo"; exit 1; }
fi

# Instala/actualiza el servicio plantilla.
echo "$PW" | sudo -S cp "$REPO/scripts/systemd/acceso-lector@.service" /etc/systemd/system/acceso-lector@.service
echo "$PW" | sudo -S systemctl daemon-reload

# Escribe el EnvironmentFile de esta instancia.
printf "KEY=%s\nVIDEO_DEV=%s\n" "$KEY" "$VIDEO" > "$HOME/.lector-$NOMBRE.env"
chmod 600 "$HOME/.lector-$NOMBRE.env"

echo "$PW" | sudo -S systemctl enable --now "acceso-lector@$NOMBRE" 2>/dev/null
echo "$PW" | sudo -S systemctl restart "acceso-lector@$NOMBRE"
sleep 2
echo "Listo: '$NOMBRE' -> $VIDEO ($(systemctl is-active acceso-lector@$NOMBRE))"
