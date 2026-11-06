#!/usr/bin/env bash
# Designa una PISTOLA HID (tipo teclado) a un rol, como servicio propio
# acceso-scanner@<NOMBRE>. Análogo a designar-lector.sh pero para pistola.
#
#   PW=dev bash scripts/designar-scanner.sh <NOMBRE> <SCANNER_DEV> <TIPO|KEY>
#
#   NOMBRE      = etiqueta de la instancia (entrada, salida, ...)
#   SCANNER_DEV = ruta estable del teclado-pistola:
#                 /dev/input/by-id/usb-XXXX-event-kbd   (ver: ls /dev/input/by-id | grep kbd)
#   TIPO        = ENTRADA_VEHICULAR | SALIDA_VEHICULAR | ENTRADA_PEATONAL | SALIDA_PEATONAL
#                 -> crea el dispositivo localmente y obtiene su KEY.
#   KEY         = o pega una apiKey ya creada en la nube (<id>.<secreto>).
set -e
PW="${PW:-dev}"
NOMBRE="${1:?Falta NOMBRE (ej. entrada, salida)}"
SCAN="${2:?Falta SCANNER_DEV (/dev/input/by-id/...-event-kbd)}"
TIPO_O_KEY="${3:?Falta TIPO o KEY}"
ADMIN_EMAIL="${ADMIN_EMAIL:-felipe@thinktech.mx}"
ADMIN_PASS="${ADMIN_PASS:-CambiaEsta#2026}"
API="http://localhost:3001/api"
REPO="$(cd "$(dirname "$0")/.." && pwd)"

sudo apt-get install -y python3-evdev >/dev/null 2>&1 || \
  echo "(Instala python3-evdev manualmente si falla: sudo apt install -y python3-evdev)"

if printf '%s' "$TIPO_O_KEY" | grep -q '\.'; then
  KEY="$TIPO_O_KEY"
else
  TIPO="$TIPO_O_KEY"
  TOK=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" \
        -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}" \
        | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d).accessToken||"")}catch(e){console.log("")}})')
  [ -z "$TOK" ] && { echo "Login fallido"; exit 1; }
  PUNTO=$(curl -s "$API/puntos" -H "Authorization: Bearer $TOK" \
        | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const a=JSON.parse(d);const t=process.argv[1];const p=a.find(x=>x.tipo===t);console.log(p?p.id:"")}catch(e){console.log("")}})' "$TIPO")
  [ -z "$PUNTO" ] && { echo "No hay punto de tipo $TIPO (créalo en la nube)."; exit 1; }
  KEY=$(curl -s -X POST "$API/puntos/$PUNTO/dispositivos" -H "Authorization: Bearer $TOK" \
        -H "Content-Type: application/json" -d "{\"nombre\":\"Pistola $NOMBRE\"}" \
        | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d).apiKey||"")}catch(e){console.log("")}})')
  [ -z "$KEY" ] && { echo "No se pudo crear el dispositivo"; exit 1; }
fi

echo "$PW" | sudo -S cp "$REPO/scripts/systemd/acceso-scanner@.service" /etc/systemd/system/acceso-scanner@.service
echo "$PW" | sudo -S systemctl daemon-reload
printf "KEY=%s\nSCANNER_DEV=%s\n" "$KEY" "$SCAN" > "$HOME/.scanner-$NOMBRE.env"
chmod 600 "$HOME/.scanner-$NOMBRE.env"
echo "$PW" | sudo -S systemctl enable --now "acceso-scanner@$NOMBRE" 2>/dev/null
echo "$PW" | sudo -S systemctl restart "acceso-scanner@$NOMBRE"
sleep 2
echo "Listo: pistola '$NOMBRE' -> $SCAN ($(systemctl is-active acceso-scanner@$NOMBRE))"
