# Despliegue en AWS — Ambiente de pruebas (EC2 todo-en-uno)

Guía **manual** (consola AWS + servidor) para publicar el MVP en una sola
instancia EC2 en **us-east-1**: API + web + PostgreSQL en la misma máquina,
accesible por internet. Es la opción más rápida y barata para validar el
ambiente; para producción luego se recrea con BD gestionada (RDS) y TLS.

> Convención: reemplaza `TU-IP-PUBLICA`, `TU-USUARIO-GITHUB`, etc.
> Todos los comandos del servidor son para **Amazon Linux 2023**.

---

## Fase A — Lanzar la instancia EC2 (consola)

1. Entra a la consola AWS → región **US East (N. Virginia) us-east-1** (arriba a la derecha).
2. **EC2 → Instances → Launch instances.**
3. **Name:** `control-accesos-pruebas`.
4. **AMI:** Amazon Linux 2023 (x86_64).
5. **Instance type:** `t3.small` (2 GB RAM — recomendado para compilar).
   - Free tier: `t3.micro` (1 GB) funciona si agregas swap (Fase C, paso 0).
6. **Key pair:** crea una nueva (`control-accesos`), tipo RSA `.pem`, y **descárgala** (la necesitas para SSH). O usa **EC2 Instance Connect** (sin llave) al conectar.
7. **Network settings → Edit → Security group** (crea uno nuevo) con estas reglas de entrada:
   | Tipo | Puerto | Origen |
   |---|---|---|
   | SSH | 22 | **My IP** (solo tú) |
   | HTTP | 80 | Anywhere (0.0.0.0/0) |
   | HTTPS | 443 | Anywhere (solo si harás TLS) |
   - **No** abras 3001 ni 5432 (quedan internos).
8. **Storage:** 20 GiB gp3.
9. **Launch instance.** Espera a que quede *Running* y copia su **IPv4 pública**.

---

## Fase B — Conectarte

- **Opción fácil (sin llave):** selecciona la instancia → **Connect → EC2 Instance Connect → Connect** (abre una terminal en el navegador).
- **Por SSH (con la llave):**
  ```bash
  chmod 400 control-accesos.pem
  ssh -i control-accesos.pem ec2-user@TU-IP-PUBLICA
  ```

---

## Fase C — Preparar el servidor

```bash
# 0) (Solo t3.micro) crear 2 GB de swap para que no falle la compilación
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 1) Actualizar y utilidades
sudo dnf update -y
sudo dnf install -y git nginx

# 2) Node 22 LTS + pnpm
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo dnf install -y nodejs
sudo npm install -g pnpm

# 3) PostgreSQL 15
sudo dnf install -y postgresql15-server postgresql15
sudo postgresql-setup --initdb
sudo systemctl enable --now postgresql
```

Permitir conexión local sin contraseña (solo escucha en localhost, SG cerrado → aceptable para pruebas):

```bash
# Poner en 'trust' las líneas de 127.0.0.1 / ::1 / local
sudo sed -i 's/^\(host\s*all\s*all\s*127.0.0.1\/32\s*\).*/\1trust/' /var/lib/pgsql/data/pg_hba.conf
sudo sed -i 's/^\(host\s*all\s*all\s*::1\/128\s*\).*/\1trust/'       /var/lib/pgsql/data/pg_hba.conf
sudo sed -i 's/^\(local\s*all\s*all\s*\).*/\1trust/'                 /var/lib/pgsql/data/pg_hba.conf
sudo systemctl restart postgresql

# Crear la base
sudo -u postgres createdb control_accesos
```

---

## Fase D — Bajar el código (clonar el repo público)

El repositorio es **público**, así que se clona **sin token**, directo en el servidor:

```bash
cd ~
git clone https://github.com/GabChung001/CA-TEST.git Control-de-Accesos
cd Control-de-Accesos
```

> Así `scripts/deploy.sh` funciona tal cual para actualizar después (hace `git pull`).
>
> **Alternativa sin GitHub (offline):** desde tu PC
> `git archive --format=zip -o "$env:USERPROFILE\Downloads\app.zip" main`, súbelo con
> `scp -i KEY.pem app.zip ec2-user@IP:~/` y en el servidor
> `sudo dnf install -y unzip && mkdir -p ~/Control-de-Accesos && cd ~/Control-de-Accesos && unzip -o ~/app.zip`.
> (Ojo: así NO queda como repo git; para usar `deploy.sh` conviértelo como indica
> "Actualizar a una versión nueva".)

---

## Fase E — Configurar y construir

```bash
cd ~/Control-de-Accesos

# 1) .env de la API (genera 3 secretos distintos automáticamente)
cat > apps/api/.env <<EOF
DATABASE_URL=postgresql://postgres@localhost:5432/control_accesos?schema=public
API_PORT=3001
JWT_ACCESS_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")
JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
QR_SIGNING_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")
PRESENCIA_RESET_HORAS=24
EOF
# Nota: NO se pone NODE_ENV=production en HTTP (la cookie de sesión debe ir sin 'Secure').

# 2) .env de la web: API en el mismo origen vía nginx
echo 'VITE_API_URL=/api' > apps/web/.env

# 3) Instalar, generar cliente Prisma, construir, migrar y sembrar
pnpm install
pnpm --filter @acceso/shared build
pnpm --filter @acceso/api exec prisma generate        # IMPRESCINDIBLE antes de build/seed
pnpm --filter @acceso/api exec prisma migrate deploy
pnpm --filter @acceso/api run db:seed                 # super admin inicial
pnpm --filter @acceso/api build
pnpm --filter @acceso/web build

# 4) Publicar la web para nginx
sudo cp -r apps/web/dist/* /usr/share/nginx/html/
```

---

## Fase F — nginx + servicio de la API

**nginx:** edita `/etc/nginx/nginx.conf` y **reemplaza el bloque `server { ... }`** (el que tiene `listen 80`) por:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    location / {
        try_files $uri /index.html;
    }
}
```

```bash
sudo nginx -t && sudo systemctl enable --now nginx && sudo systemctl restart nginx
```

**API como servicio systemd:** crea `/etc/systemd/system/acceso-api.service`:

```ini
[Unit]
Description=Control de Accesos API
After=network.target postgresql.service

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/Control-de-Accesos/apps/api
ExecStart=/usr/bin/node dist/main.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now acceso-api
sudo systemctl status acceso-api --no-pager      # debe decir 'active (running)'
curl -s http://localhost:3001/api/health         # {"status":"ok","db":"ok",...}
```

---

## Fase G — Probar

Abre en el navegador: **http://TU-IP-PUBLICA**

Entra con el super admin sembrado (`felipe@thinktech.mx` / la contraseña del seed).
Crea parque y puntos de acceso en **Configuración**, bodegas, personal + **QR**.
Los QR se validan en la **controladora de la caseta** (cámara/tótem); ver
[CONTROLADORA-CASETA.md](CONTROLADORA-CASETA.md) y [OPERACION-CASETA.md](OPERACION-CASETA.md).

---

## Actualizar a una versión nueva (desde GitHub)

El repo `GabChung001/CA-TEST` es **público**, así que **no hace falta token**. Si el
servidor aún apunta al remoto viejo (con PAT), déjalo en la URL pública **una sola vez**:
```bash
cd ~/Control-de-Accesos
git remote set-url origin https://github.com/GabChung001/CA-TEST.git
```

Después, **cada actualización es un comando**:
```bash
cd ~/Control-de-Accesos && bash scripts/deploy.sh
```
`scripts/deploy.sh` hace, en orden: `git fetch` + `reset --hard origin/main` + `clean`
+ `pnpm install` + Prisma (`generate` / `migrate deploy`) + build de API y web +
copiar la web a nginx + reiniciar la API. Tu `.env` **no se toca** (está en `.gitignore`).

> **Flujo completo de trabajo:** desarrollas en tu PC → `git push` a GitHub → en AWS
> corres `bash scripts/deploy.sh`. Al terminar imprime la versión activa
> (`git log --oneline -1`), que debe coincidir con tu último commit en GitHub.

Si la carpeta de AWS **no fuera** un repo git (se instaló por zip), conviértela una vez:
```bash
cd ~/Control-de-Accesos
git init
git remote add origin https://github.com/GabChung001/CA-TEST.git
git fetch origin
git reset --hard origin/main      # sobre-escribe lo versionado; respeta .env (gitignored)
bash scripts/deploy.sh
```

---

## Operación y mantenimiento (día a día)

### Conectarte al servidor
Desde tu PC (PowerShell). Ajusta la IP si cambió (ver más abajo):
```bash
ssh -i "C:\Users\User\Downloads\KEY.pem" ec2-user@TU-IP-PUBLICA
```
Si da *"UNPROTECTED PRIVATE KEY FILE"* en Linux/Mac: `chmod 400 KEY.pem`. En Windows
no aplica (NTFS); si molesta, quita herencia de permisos del archivo.

### Ver el estado de los servicios
```bash
systemctl status acceso-api --no-pager      # API (debe decir active running)
systemctl status nginx --no-pager           # web
systemctl status postgresql --no-pager      # base de datos
curl -s http://localhost:3001/api/health     # {"status":"ok",...}
curl -s -o /dev/null -w '%{http_code}\n' http://localhost/   # 200 = panel OK
```

### Ver logs (errores)
```bash
# Últimas 100 líneas de la API
sudo journalctl -u acceso-api -n 100 --no-pager
# En vivo (Ctrl+C para salir)
sudo journalctl -u acceso-api -f
# Errores de nginx
sudo tail -n 50 /var/log/nginx/error.log
```

### Reiniciar servicios
```bash
sudo systemctl restart acceso-api        # tras un cambio de .env o si se trabó
sudo systemctl restart nginx
sudo systemctl restart postgresql
```

### Respaldo y restauración de la base de datos
```bash
# Respaldo (genera un archivo con fecha)
pg_dump -U postgres control_accesos > ~/backup-$(date +%F).sql
# Descargarlo a tu PC (desde PowerShell, en tu equipo):
#   scp -i "C:\Users\User\Downloads\KEY.pem" ec2-user@TU-IP-PUBLICA:~/backup-*.sql .
# Restaurar (CUIDADO: sobre-escribe datos)
psql -U postgres control_accesos < ~/backup-2026-11-05.sql
```
> Programa un respaldo diario con cron si esto será productivo:
> `echo '0 3 * * * pg_dump -U postgres control_accesos > ~/backup-$(date +\%F).sql' | crontab -`

### La contraseña del super admin
Se define en el seed. Si la olvidaste, puedes re-sembrar o cambiarla por SQL/endpoint;
pídeme el comando. El usuario inicial es `felipe@thinktech.mx`.

---

## Solución de problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| El panel no carga (timeout) | Instancia apagada o IP cambió | Verifica que esté *Running* y usa la IP nueva (ver abajo) |
| Panel carga pero **502 Bad Gateway** | La API (`acceso-api`) está caída | `sudo journalctl -u acceso-api -n 80`; corrige y `sudo systemctl restart acceso-api` |
| `deploy.sh` falla en el build (se congela/mata) | Poca RAM (t3.micro) | Crea swap (Fase C paso 0) y reintenta |
| Login falla / "db error" | PostgreSQL caído o `DATABASE_URL` mal | `systemctl status postgresql`; revisa `apps/api/.env` |
| La controladora no sincroniza | `CLOUD_URL` del edge apunta a la IP vieja de AWS | Actualiza `CLOUD_URL` en el edge (ver abajo) |
| Cambios no aparecen en el panel | Caché del navegador | **Ctrl + Shift + R** (recarga forzada) |
| `git` pide usuario/contraseña | Remoto apunta al PAT viejo | `git remote set-url origin https://github.com/GabChung001/CA-TEST.git` |

### La API no arranca tras un deploy
Casi siempre es el `.env` o Prisma. Revisa:
```bash
sudo journalctl -u acceso-api -n 60 --no-pager
cd ~/Control-de-Accesos
pnpm --filter @acceso/api exec prisma generate   # regenerar cliente
pnpm --filter @acceso/api exec prisma migrate deploy
sudo systemctl restart acceso-api
```

---

## IP pública: fijarla con Elastic IP (muy recomendado)

Mientras la IP cambie en cada reinicio tendrás que reconfigurar la controladora.
**Fíjala una vez** con una Elastic IP y te olvidas:
1. EC2 → **Elastic IPs → Allocate Elastic IP address → Allocate**.
2. Selecciónala → **Actions → Associate** → elige tu instancia → **Associate**.
3. Esa IP ya no cambia. Actualiza entonces `CLOUD_URL` del edge **una última vez**
   a esa IP fija y listo.

Mientras **no** uses Elastic IP, cada vez que cambie la IP de AWS, en la
**controladora/edge**:
```bash
cd ~/Control-de-Accesos
sed -i -E "s|^CLOUD_URL=.*|CLOUD_URL=http://NUEVA-IP/api|" apps/api/.env
sudo systemctl restart acceso-api
```
> La web servida desde AWS **no** necesita cambios al cambiar la IP (usa rutas
> relativas `/api`); solo el `CLOUD_URL` del edge apunta por IP.

---

## Costos y apagado

- `t3.small` on-demand ≈ US$0.02/h (~US$15/mes si queda encendida 24/7).
- Para no gastar entre pruebas: **EC2 → Instance state → Stop** (al reiniciar cambia la IP pública salvo que uses una Elastic IP).
- Borrar todo: **Terminate** la instancia y elimina el volumen.

---

## Siguiente (hacia producción)

1. **HTTPS:** registra un dominio, apúntalo a la IP (Elastic IP), e instala TLS con
   Let's Encrypt (`sudo dnf install certbot python3-certbot-nginx; sudo certbot --nginx`).
   Con HTTPS ya puedes poner `NODE_ENV=production` (cookie `Secure`).
2. **BD gestionada:** migrar PostgreSQL a **RDS** (respaldos, alta disponibilidad).
3. **Separar web** a S3 + CloudFront y la API detrás de balanceador/autoescalado.
4. **Nodo edge de caseta** sincronizando contra esta nube (operación offline).
5. Endurecimiento SGSI: cifrar `mfaSecret`, rotación de secretos, monitoreo/alarmas.
