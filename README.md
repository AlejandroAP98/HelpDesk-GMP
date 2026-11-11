# HelpDesk-GMP

Sistema de gestion de tickets **multi-tenant** (multi-empresa) con asignacion manual,
maquina de estados estricta y alertas en tiempo real para tickets urgentes.

Basado en la especificacion definida en [`agent.md`](./agent.md).

## Stack

| Capa | Tecnologia |
|---|---|
| Frontend | Next.js 14 + Tailwind CSS |
| Backend | Python 3.12 + FastAPI + SQLAlchemy async |
| DB | PostgreSQL 16 (pgcrypto) |
| Tiempo real / cache | Redis 7 + WebSockets |
| Almacenamiento adjuntos | MinIO (S3-compatible) |
| Scheduler | APScheduler (cierre automatico de tickets) |
| Reverse proxy (prod) | Caddy 2 (TLS auto-firmado en LAN) |
| Tunel externo | Cloudflare Tunnel + Zero Trust (OTP por email) |
| Monitoreo | Prometheus + Grafana + Loki (solo prod) |
| Notificaciones | Web Push (VAPID) + Resend (email) + Telegram Bot |
| PWA | Instalable con service worker y shortcuts |

## Arquitectura de despliegue

- **Desarrollo**: Windows + WSL2 + Docker Desktop. Hot-reload via localhost.
- **Produccion**: Linux (Ubuntu Server 24.04 LTS) con Docker Engine nativo.
- Un unico `docker-compose.yml` + overrides (`dev`/`prod`) portables entre hosts.

## Funcionalidades principales

- **Multi-tenant**: aislamiento por empresa en tickets, sedes y metricas (RBAC admin/agente/cliente).
- **Tickets**: maquina de estados estricta, asignacion manual, prioridades, estado "en espera", reaperturas.
- **SLA**: matriz por elemento/ciudad/prioridad (torre/celda 4h, base 24h, remoto 48h), FRT 0.5h, horario laboral configurable.
- **Sedes**: puntos de venta sincronizados desde Supabase (GMP).
- **Comentarios y adjuntos**: notas internas, adjuntos solo imagenes (optimizadas a WebP en el cliente, lightbox, adjuntos dentro de comentarios).
- **Tiempo real**: WebSockets + Redis Pub/Sub con auth post-handshake, toasts y alertas urgentes.
- **Notificaciones**: Web Push VAPID (multi-dispositivo), email transaccional (Resend), grupo de Telegram, PWA instalable.
- **Metricas**: dashboard con MTTR/FRT, tendencia, heatmap de distribucion, rendimiento por agente, reaperturas y cumplimiento SLA.
- **Monitoreo**: Prometheus + Grafana + Loki con dashboards de overview, infraestructura, aplicacion, DB y logs.
- **Operacion**: backups automaticos a Google Drive (rclone), systemd auto-restart, cierre auto de tickets resueltos.

## Estructura del repositorio

```
HelpDesk-GMP/
├── agent.md                   Especificacion original del sistema
├── AGENTS.md                  Guia de fases, convenciones y comandos para agentes
├── Manual.md                  Manual de uso para operadores
├── MatrizPrioridades.md       Matriz categoria/subcategoria/elemento -> prioridad
├── docker-compose.yml         Base del stack (compartido dev/prod)
├── docker-compose.dev.yml     Override de desarrollo (hot-reload, sin Caddy)
├── docker-compose.prod.yml    Override de produccion (Caddy + monitoreo + restart)
├── .env.example               Variables de entorno (copiar a .env)
├── caddy/Caddyfile            Reverse proxy TLS para LAN + bloque HTTP movil
├── monitoring/                Prometheus, Grafana (dashboards) y Loki
├── backend/                   API FastAPI + Poetry + Alembic
├── frontend/                  Next.js 14 + Tailwind (PWA)
├── scheduler/                 APScheduler (cierre auto de tickets)
├── scripts/                   backup.sh, seed, sync_sedes_supabase, tests E2E
├── deploy/                    Unit systemd para auto-restart en boot
└── backups/                   Volcado de backups nocturnos (host Linux)
```

## Requisitos previos

### Desarrollo (Windows)

1. WSL2 habilitado: `wsl --install -d Ubuntu`
2. Docker Desktop con backend WSL2 (Settings > Resources > WSL Integration > Ubuntu ON)
3. VS Code + extension `Remote-WSL`
4. Trabajar el repo dentro del filesystem de WSL: `\\wsl$\Ubuntu\home\<usuario>\HelpDesk-GMP`

### Produccion (Linux)

1. Instalar Docker Engine: `curl -fsSL https://get.docker.com | sh`
2. Instalar avahi-daemon (resolucion mDNS): `sudo apt install -y avahi-daemon`
3. Abrir puertos en firewall: `sudo ufw allow 80,443/tcp`
4. Hostname estatico del servidor (ej. `servidor`)

## Uso rapido

### Desarrollo

```bash
# Copiar variables
cp .env.example .env

# Levantar entorno dev (hot-reload, sin Caddy)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

# Acceder:
#   Frontend:        http://localhost:3000
#   API docs:        http://localhost:8000/docs
#   MinIO consola:   http://localhost:9001
```

### Produccion (Linux)

```bash
cp .env.example .env
# Editar .env: APP_ENV=prod, JWT_SECRET=<valor aleatorio>, COOKIE_SECURE=false

docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod up -d --build

# Seed inicial
docker compose exec backend python -m scripts.seed
```

#### Acceso multiplataforma

| Dispositivo | URL | TLS |
|---|---|---|
| PC (Windows) | `https://helpdesk.local` | Si (con CA instalado) |
| Movil (Android/iOS) | `http://192.168.1.9` | No (HTTP en LAN) |
| Externo (internet) | `https://soporte.tudominio.com` | Si (Cloudflare) |

El acceso externo va por Cloudflare Tunnel (outbound, sin puertos abiertos) con Zero Trust Access (OTP por email). Requiere `CLOUDFLARE_TUNNEL_TOKEN` en `.env` y activar la PWA en movil para recibir Web Push en iOS.

Para que el PC resuelva `helpdesk.local`, agregar al archivo `C:\Windows\System32\drivers\etc\hosts`:

```
192.168.1.9  helpdesk.local
```

### TLS / CA interna (produccion)

Caddy genera su propia CA dentro del volumen `caddy_data`. Para eliminar advertencias:

```bash
# Extraer root CA
docker compose exec caddy cat /data/caddy/pki/authorities/local/root.crt > servidor-root-ca.crt
```

#### Windows

Doble click en `servidor-root-ca.crt` > **Instalar certificado** > **Equipo local** > **Automatico** > **Finalizar**.

#### Android

1. Abrir `http://192.168.1.9/ca.crt` en el navegador (descarga automatica)
2. Ajustes > Seguridad > **Cifrado y credenciales** > **Instalar un certificado** > **CA de confianza**
3. Seleccionar el archivo descargado

#### iPhone

1. Transferir `servidor-root-ca.crt` al iPhone (AirDrop, email)
2. Abrir archivo > **Instalar perfil**
3. Ajustes > General > **Acerca de** > **Configuracion de confianza de certificados** > Activar **Caddy Local Authority**

## Comandos utiles

```bash
# Logs en vivo
docker compose logs -f backend frontend

# Aplicar migraciones
docker compose exec backend poetry run alembic upgrade head

# Seed inicial: empresa demo (id=1) + admin (admin@helpdesk.com / Admin123456)
docker compose exec backend python -m scripts.seed

# Tests del backend
docker compose exec backend poetry run pytest

# Lint / typecheck
docker compose exec backend poetry run ruff check app
docker compose exec frontend npm run lint

# Parar todo
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod down

# Actualizar produccion (despues de git pull)
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod up -d --build

# Backup Postgres (en el host Linux)
docker compose exec -T postgres pg_dump -U helpdesk helpdesk > backups/pg_$(date +%F).sql

# Backup completo (Postgres + MinIO + Redis) + subida a Google Drive
./scripts/backup.sh

# Sincronizar sedes desde Supabase (preview con --dry-run)
docker compose exec backend python -m scripts.sync_sedes_supabase
```

### Monitoreo (solo prod)

```bash
# Verificar servicios de monitoreo
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod ps | grep -E "prometheus|grafana|loki"

# Grafana (LAN): http://helpdesk.local:3001 - user: admin, pass: ${GRAFANA_PASSWORD}
# Metricas del backend: docker compose exec backend curl -s localhost:8000/metrics
```

### Auto-restart en boot (systemd)

```bash
sudo cp deploy/helpdesk.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now helpdesk.service
```

### Cron de backup diario (3am, host Linux)

```bash
mkdir -p ~/backups && chmod +x scripts/backup.sh
# 0 3 * * * /home/gmp/HelpDesk-GMP/scripts/backup.sh >> /home/gmp/backups/backup.log 2>&1
```

## Roadmap

- [x] Fase 1  - Infraestructura Docker + esqueletos
- [x] Fase 2  - Modelos SQLAlchemy + migracion inicial (esquema de agent.md)
- [x] Fase 3  - Auth (bcrypt, JWT acceso + refresh, RBAC multi-tenant) + seed inicial
- [x] Fase 4  - CRUDs admin (empresas, usuarios, categorias)
- [x] Fase 5  - Tickets + maquina de estados + asignacion manual
- [x] Fase 6  - Comentarios (publicos + notas internas) + adjuntos (MinIO)
- [x] Fase 7  - WebSockets + Redis Pub/Sub + alertas urgentes
- [x] Fase 8  - Frontend: paneles por rol, bandeja admin, detalle ticket + alertas urgentes
- [x] Fase 9  - Scheduler de cierre automatico + tests finales (30 tests)
- [x] Fase 10 - Deploy en Linux + acceso multiplataforma (PC + movil)
- [x] Fase 11 - Cloudflare Tunnel + Zero Trust (acceso externo con OTP)
- [x] Fase 12 - PWA instalable (manifest, service worker, shortcuts)
- [x] Fase 13/14 - Web Push VAPID multi-dispositivo (sin app nativa)
- [x] Fase 15 - Adjuntos solo imagenes + proxy auth + lightbox
- [x] Fase 16 - Notificacion de cambio de estado para clientes
- [x] Fase 17 - Backup automatizado + systemd auto-restart
- [x] Fase 18 - Emails transaccionales via Resend
- [x] Fase 19 - Email urgente desacoplado del toggle del cliente
- [x] Fase 20 - Notificaciones de Telegram (grupo de ops)
- [x] Auditoria de seguridad multi-tenant y transaccional (fixes A-G)
- [x] Optimizacion de performance (pool DB, indices, peso_orden generado, N+1)
- [x] Matriz de SLA por elemento/ciudad/prioridad + horario laboral
- [x] Monitoreo Prometheus + Grafana + Loki
- [x] Estado "en espera" + reportes y filtros mejorados
- [ ] Mejoras futuras (ver AGENTS.md pendientes: sync Supabase paginado, email en crear_admin)
