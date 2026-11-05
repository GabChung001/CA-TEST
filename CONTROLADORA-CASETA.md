# Controladora de caseta (nodo edge) — instalación y configuración

La **controladora** es el "cerebro" en la caseta: corre el **mismo sistema** que
la nube, pero con una **base de datos local**. Valida los accesos en la **red
local** (milisegundos) y **funciona sin internet**. Se **sincroniza** con la
nube: baja altas/bajas de personal y sube los movimientos.

Sirve en un **mini PC** (Ubuntu Server 24.04 LTS / Debian 12) o en una
**Raspberry Pi 4/5** (64-bit: Raspberry Pi OS Lite 64-bit o Ubuntu Server).
Todo se hace **por terminal/SSH**, sin monitor.

> Valores que debes copiar **idénticos** desde la nube (de su `apps/api/.env`):
> - `EDGE_SYNC_KEY` → autentica la controladora con la nube.
> - `QR_SIGNING_SECRET` → para que los QR emitidos en la nube validen aquí.
>
> Y el **parque que atiende esta caseta**:
> - `PARQUE_ID` → lo ves en la web, en **Configuración → Parques**. Con él, la
>   controladora **solo sincroniza y valida ese parque** (los accesos son por
>   parque/bodega). Cada caseta = un parque.

---

## 0. Antes de empezar
- Instala el SO (Ubuntu Server 24.04 / Raspberry Pi OS 64-bit) y habilita **SSH**.
- Conéctate desde tu laptop: `ssh usuario@IP-DE-LA-CONTROLADORA`.
- En Raspberry, usa **SSD por USB** (no microSD) para operación 24/7.

### Crear la VM e instalar Ubuntu Server (para pruebas en tu PC)
1. En **VirtualBox** o **Hyper-V**, crea una VM Linux 64-bit: **2 vCPU, 2–4 GB RAM, 20 GB** de disco.
2. **Red en modo "Puente/Bridged"** → la VM tendrá su propia IP en tu LAN (así tu laptop, los lectores y el ESP32 la alcanzan).
3. Monta la ISO de **Ubuntu Server 24.04 LTS** e instala; en el instalador marca **"Install OpenSSH server"**. Define tu usuario y contraseña.
4. Al terminar, dentro de la VM corre `ip a` para ver su IP, y desde tu laptop: `ssh usuario@IP-DE-LA-VM`.
5. Sigue el resto de esta guía por SSH (sin monitor).

## 1. Preparar el sistema
```bash
sudo apt-get update
sudo apt-get install -y git nginx curl unzip postgresql

# Node 22 LTS (funciona en x86_64 y en ARM64/Raspberry)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pnpm

# Solo si tiene < 2 GB de RAM (p. ej. Raspberry Pi 4GB está bien, 2GB conviene swap)
# sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

PostgreSQL local (escucha solo en localhost; aceptable con `trust` para pruebas):
```bash
sudo systemctl enable --now postgresql
HBA=$(sudo -u postgres psql -tAc "SHOW hba_file")
sudo sed -i -E 's|^(local\s+all\s+all\s+)\S+.*|\1trust|'               "$HBA"
sudo sed -i -E 's|^(host\s+all\s+all\s+127\.0\.0\.1/32\s+)\S+.*|\1trust|' "$HBA"
sudo sed -i -E 's|^(host\s+all\s+all\s+::1/128\s+)\S+.*|\1trust|'         "$HBA"
sudo systemctl restart postgresql
sudo -u postgres createdb control_accesos
```

## 2. Bajar el código (clonar desde GitHub)
El repositorio es privado → usa un **PAT de GitHub** (igual que en AWS). Todo se
hace **en la controladora** (no en tu PC):
```bash
cd ~
git clone https://TU_PAT@github.com/GabChung001/CA-TEST.git Control-de-Accesos
cd Control-de-Accesos
```
> Reemplaza `TU_PAT` por tu token. Para **actualizarla** después:
> `cd ~/Control-de-Accesos && bash scripts/deploy.sh`.

## 3. Configurar el `.env` del edge
`EDGE_SYNC_KEY` y `QR_SIGNING_SECRET` deben ser **los mismos de la nube**; los
JWT pueden ser locales. Reemplaza `TU-IP-NUBE` y las dos llaves de la nube:
```bash
cd ~/Control-de-Accesos
cat > apps/api/.env <<EOF
DATABASE_URL=postgresql://postgres@localhost:5432/control_accesos?schema=public
API_PORT=3001

SYNC_ROLE=edge
CLOUD_URL=http://TU-IP-NUBE/api
EDGE_SYNC_KEY=PEGA-LA-MISMA-LLAVE-DE-LA-NUBE
SYNC_INTERVAL_SEG=30
PARQUE_ID=EL-ID-DEL-PARQUE-DE-ESTA-CASETA

QR_SIGNING_SECRET=PEGA-EL-MISMO-QR_SIGNING_SECRET-DE-LA-NUBE

JWT_ACCESS_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")
JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
PRESENCIA_RESET_HORAS=24
EOF
# La web (panel local) apunta a la API local:
echo 'VITE_API_URL=/api' > apps/web/.env
```

## 4. Instalar, generar, migrar (SIN seed) y construir
La controladora **no** se siembra: sus datos llegan de la nube por sync.
```bash
pnpm install
pnpm --filter @acceso/shared build
pnpm --filter @acceso/api exec prisma generate
pnpm --filter @acceso/api exec prisma migrate deploy
pnpm --filter @acceso/api build
pnpm --filter @acceso/web build
sudo cp -r apps/web/dist/* /usr/share/nginx/html/
```

## 5. nginx (panel local) + API como servicio
nginx igual que en AWS (sirve el panel y hace proxy a `/api`). Respáldalo y
reemplaza el `server { listen 80 ... }` de `/etc/nginx/sites-available/default`
(Ubuntu/Debian) por el mismo bloque de la guía de AWS (`DESPLIEGUE-AWS.md`, Fase F),
con `root /usr/share/nginx/html;`. Luego:
```bash
sudo nginx -t && sudo systemctl enable --now nginx && sudo systemctl restart nginx
```
Servicio de la API:
```bash
sudo tee /etc/systemd/system/acceso-api.service > /dev/null <<'EOF'
[Unit]
Description=Control de Accesos (controladora de caseta)
After=network.target postgresql.service

[Service]
Type=simple
User=REEMPLAZA-TU-USUARIO
WorkingDirectory=/home/REEMPLAZA-TU-USUARIO/Control-de-Accesos/apps/api
ExecStart=/usr/bin/node dist/main.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now acceso-api
```

## 6. Verificar la sincronización
```bash
curl -s http://localhost:3001/api/health; echo
journalctl -u acceso-api -n 20 --no-pager | grep -i sincroniz   # "Sincronización edge activa…"
```
Crea una persona/credencial en la **web de la nube**; en ~30 s aparece en la
controladora (entra a su panel local o valida el QR).

## 7. Lectores y relé (pluma / torniquete)
- **Lector** (cámara web, lector QR USB, o tótem): apunta al edge por LAN y llama
  a `POST /api/acceso/validar`. El sistema responde `abrirBarrera: true/false`.
- **Relé/pinout:**
  - **Raspberry Pi:** pines **GPIO** → módulo de relé → contacto seco de la pluma/torniquete (lo más directo).
  - **Mini PC:** módulo de **relé USB** (no tiene GPIO).
  - Cuando `abrirBarrera=true`, la controladora dispara el pulso al relé. Esa capa
    de "driver" se conecta cuando tengas el hardware (está prevista en el diseño).

## 8. Operación
- Si se cae internet, la controladora **sigue validando** con su copia local;
  los movimientos se **encolan** y suben solos al reconectar.
- La presencia (anti-passback) y el reset de 24 h **viven en la controladora**.
- Si **cambia la IP de la nube** (instancia sin Elastic IP), actualiza el `CLOUD_URL`:
  ```bash
  sed -i -E "s|^CLOUD_URL=.*|CLOUD_URL=http://NUEVA-IP/api|" apps/api/.env
  sudo systemctl restart acceso-api
  ```
- Actualizar versión: `cd ~/Control-de-Accesos && bash scripts/deploy.sh`.
