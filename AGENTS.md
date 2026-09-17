# AGENTS.md - Guia para agentes y desarrolladores

## Comandos del proyecto

### Docker (desarrollo)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build   # levantar
docker compose -f docker-compose.yml -f docker-compose.dev.yml down             # parar
docker compose logs -f backend frontend                                          # logs
```

### Backend (Python + Poetry)

> **Nota:** el contenedor `backend` de dev NO incluye las dev-dependencies
> (`ruff`, `mypy`, `pytest`). Para correr lint/typecheck/tests hay que
> instalarlas una vez dentro del contenedor:
>
> ```bash
> docker compose exec -f docker-compose.yml -f docker-compose.dev.yml backend \
>   poetry install --with dev --no-root
> ```
>
> Si `poetry install` falla por red (DNS/proxy), como alternativa correr
> localmente (requiere Python 3.12 + Poetry en el host):
>
> ```bash
> cd backend && poetry install --with dev && poetry run ruff check app
> ```

```bash
# Tests
docker compose exec backend poetry run pytest

# Lint / formato
docker compose exec backend poetry run ruff check app
docker compose exec backend poetry run ruff format app

# Type check
docker compose exec backend poetry run mypy app

# Migraciones
docker compose exec backend poetry run alembic revision --autogenerate -m "<mensaje>"
docker compose exec backend poetry run alembic upgrade head
```

### Frontend (Next.js + TypeScript)

```bash
docker compose exec frontend npm run lint
docker compose exec frontend npm run typecheck
docker compose exec frontend npm run build
```

### Docker (produccion - Linux)

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod up -d --build
```

### Backup y Restore

```bash
# Backup completo (PostgreSQL + MinIO + Redis + .env) + subir a Google Drive
./scripts/backup.sh

# Backup sin subir a Drive
./scripts/backup.sh --no-upload

# Restaurar backup local
./scripts/backup.sh --restore YYYYMMDD_HHMMSS

# Listar backups en Google Drive
./scripts/backup.sh --list-remote

# Restaurar desde Google Drive
./scripts/backup.sh --restore-gdrive YYYYMMDD_HHMMSS

# Cron de backup diario a las 3am (con subida a Drive):
# 0 3 * * * /home/gmp/HelpDesk-GMP/scripts/backup.sh >> /var/log/helpdesk-backup.log 2>&1
```

**Configuracion de rclone (una vez):**

```bash
# Instalar rclone
sudo apt install rclone -y

# Configurar remote de Google Drive
rclone config
# 1. n (nuevo remote)
# 2. Nombre: gdrive
# 3. Tipo: drive (Google Drive)
# 4. client_id/client_secret: vacio (usar defaults)
# 5. scope: 1 (acceso completo)
# 6. Dejar resto por defecto
# 7. Abrir URL de autorizacion en navegador
# 8. Pegar codigo de verificacion

# Variables configurables en backup.sh:
#   GDRIVE_REMOTE=gdrive          # nombre del remote en rclone
#   GDRIVE_FOLDER=HelpDesk-GMP-Backups  # carpeta en Drive
#   GDRIVE_KEEP_DAYS=30           # dias de retencion en Drive
```

### Sincronizacion de sedes (Supabase -> HelpDesk)

```bash
# Sincroniza sedes desde Supabase (GMP) a la tabla puntos_venta
docker compose exec backend python -m scripts.sync_sedes_supabase

# Preview sin aplicar cambios
docker compose exec backend python -m scripts.sync_sedes_supabase --dry-run
```

Requiere `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en el `.env` del backend HelpDesk.

### Systemd (auto-restart en boot)

```bash
sudo cp deploy/helpdesk.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable helpdesk.service
sudo systemctl start helpdesk.service
sudo systemctl status helpdesk.service
```

### Monitoring (Prometheus + Grafana + Loki)

```bash
# Verificar estado de servicios de monitoreo
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod ps | grep -E "prometheus|grafana|loki|promtail|exporter"

# Ver logs de Prometheus
docker compose logs -f prometheus

# Ver logs de Grafana
docker compose logs -f grafana

# Recargar Prometheus sin reiniciar (aplica cambios de config)
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod exec prometheus kill -HUP 1

# Ver targets de Prometheus (estado de scrapes)
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod exec prometheus wget -qO- http://localhost:9090/api/v1/targets 2>/dev/null

# Métricas del backend (el backend tiene curl instalado)
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod exec backend curl -s localhost:8000/metrics | head -20

# Acceder a Grafana (LAN)
# URL: http://helpdesk.local:3001 o http://<server-ip>:3001
# User: admin
# Pass: ${GRAFANA_PASSWORD} (default: helpdesk)

# NOTA: /metrics vía Caddy (http://<lan-ip>/metrics) está restringido a
# la subnet 192.168.0.0/16. Desde internet (túnel Cloudflare) responde 403.
```

**Dashboards de Grafana:**

- **Overview**: Estado general de servicios, requests/s, latencia, errores
- **Infrastructure**: CPU, RAM, disco, load, network del host (node-exporter)
- **Application**: HTTP requests, duracion, status codes, in-flight
- **Database**: PostgreSQL (conexiones, transacciones, tamaño) + Redis (memoria, hits/misses)
- **Logs**: Explorador de logs por container con Loki

**Servicios de monitoreo (solo prod):**

| Servicio | Puerto | Propósito |
|---|---|---|
| Prometheus | 9090 (interno) | Recolectar métricas |
| Grafana | 3001 (host) | Dashboards visuales |
| Loki | 3100 (interno) | Logs centralizados |
| Promtail | 9080 (interno) | Enviar logs a Loki |
| Node Exporter | 9100 (interno) | Métricas del host |
| Postgres Exporter | 9187 (interno) | Métricas de PostgreSQL |
| Redis Exporter | 9121 (interno) | Métricas de Redis |

**Variables de entorno:**

- `GRAFANA_PASSWORD` - Password de Grafana (default: helpdesk)

**Retención de datos:**

- Prometheus: 15 días
- Loki: 15 días (360h)
- Grafana: indefinido (almacenamiento persistente)

**Caveat multi-worker:** el backend corre con 4 workers uvicorn; Prometheus scrapea
un solo worker por request, por lo que los contadores (`http_requests_total`) pueden
aparecer "jumpy". Suficiente para señal básica; si se necesita exactitud, migrar a
`PROMETHEUS_MULTIPROC_DIR` (modo multiprocess de prometheus_client).

## Convenciones

- **Backend**: Python 3.12, FastAPI, SQLAlchemy async (asyncpg), Pydantic v2.
  - Sin comentarios en el codigo salvo que se soliciten.
  - Tipado estricto con mypy.
  - Rutas async (`async def`), prefijo `/api` para REST, `/ws` para WebSockets.
  - Models SQLAlchemy reutilizan los tipos ENUM definidos en `agent.md` (rol_usuario,
    estado_ticket, prioridad_ticket). IDs UUID con `gen_random_uuid()` por default.
  - Aislamiento multi-tenant: tickets filtrados por `empresa_id` segun el usuario
    autenticado (`cliente`) o visible globalmente (`agente`/`admin`).

- **Frontend**: Next.js 14 App Router, TypeScript estricto, Tailwind.
  - Sin comentarios en el codigo salvo que se soliciten.
  - `zustand` para estado global de alertas urgentes.
  - WebSocket cliente en `src/hooks/useWebSocket.ts` con reconnect automatico.

- **Migraciones**: autogeneradas desde modelos SQLAlchemy con Alembic. NO escribir SQL
  crudo excepto para semilla inicial (`seeds`).

- **Commits**: estandariar (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`).
  No commitear `.env`.

## Stack tecnologico (resumen)

| Capa | Tecnologia |
|---|---|
| Frontend | Next.js 14 + Tailwind + TypeScript + zustand + axios |
| Backend | Python 3.12 + FastAPI + SQLAlchemy 2 async + Pydantic v2 |
| DB | PostgreSQL 16 (pgcrypto, asyncpg) |
| Cache/RT | Redis 7 (Pub/Sub + WebSockets) |
| Storage | MinIO (S3-compatible) para adjuntos |
| Scheduler | APScheduler (cierre auto de tickets resueltos) |
| Proxy | Caddy 2 (TLS auto-firmado en LAN, mDNS) |
| Orquestacion | Docker Compose (base + overrides dev/prod) |

## Estado actual

Fase 1 completada: infraestructura Docker + esqueletos backend/frontend/scheduler.
Fase 2 completada: modelos SQLAlchemy + migracion inicial `cad5c324aa81` reproduciendo
exactamente el esquema de `agent.md` §2 (6 tablas, 3 ENUMs, UUIDs con `gen_random_uuid()`,
indices recomendados y acciones FKreferidas).
Fase 3 completada: Auth con bcrypt + JWT (acceso 30min / refresh 7dias), dependencias
RBAC (`require_admin`, `require_agente`, `require_cliente`) y aislamiento multi-tenant
(`tenant_filter`). Endpoints `/api/auth/{register,register/agente,login,refresh,me,logout}`.
Seed inicial `python -m scripts.seed` crea empresa demo (id=1) + admin inicial.
Fase 4 completada: CRUDs admin para empresas, usuarios y categorias con paginacion
(`Pagina[T]`), filtros (rol, empresa_id), validacion de UNIQUE y proteccion de borrado
con FK. Endpoints `/api/{empresas,usuarios,categorias}` con RBAC `require_admin` para
mutaciones; categorias legibles por cualquier autenticado.
Fase 5 completada: Tickets con maquina de estados estricta (`services/estados.py` con
matriz de transiciones) y asignacion manual. Endpoints `/api/tickets` con CRUD, listado
filtrado por empresa/estado/prioridad/agente/cliente, `/asignar` (admin), `/estado`
(transiciones validadas), `/cerrar`, `/reabrir`. Aislamiento multi-tenant en listar y
obtener (`tenant_filter`): clientes solo ven tickets de su empresa; agentes ven los
asignados a ellos; admins ven todos.
Fase 6 completada: Comentarios publicos/notas internas (`es_nota_interna`) con
visibilidad filtrada por rol (clientes soloven publicos; agentes/admins ven todos) y
adjuntos a MinIO con cliente boto3 (`core/storage.py`, bucket auto-creado en lifespan,
limite 10MB). Endpoints `/api/tickets/{id}/comentarios` (GET, POST) y
`/api/tickets/{id}/adjuntos` (GET, POST multipart, DELETE). Clientes no pueden emitir
notas internas; borrado restringido al autor/agente asignado.
Fase 7 completada: WebSockets + Redis Pub/Sub + alertas urgentes en tiempo real.
ConnectionManager con rooms por rol/ticket (`websockets/manager.py`), publicador
y listener sobre canal `helpdesk:ws` (`websockets/pubsub.py` arrancado en lifespan),
endpoint `ws://host:8000/ws?token=<JWT>` autenticado. Hook en `ticket_service.crear`
publica `ticket:urgent_created` a roles agente/administrador cuando prioridad=urgente.
Frontend: hook `useWebSocket` con reconnect, store zustand `urgentStore`, componente
`UrgentToasts` con beep (AudioContext 880Hz) y resaltado rojo `animate-pulse`.
Validado E2E: agente recibe el evento, cliente no.
Fase 8 completada: Frontend completo con paneles por rol. Axios client con
interceptor de refresh (`lib/api.ts`), store zustand `authStore` con persist,
endpoints tipados en `lib/endpoints`. Login (`/login`) + route group `(panel)`
con `AuthGuard` y `Sidebar` por rol. Dashboard (`/`), listado con filtros
(`/tickets`), nuevo ticket (`/tickets/nuevo`), detalle con comentarios/adjuntos/
estados (`/tickets/[id]`), bandeja admin con asignacion (`/admin/bandeja`).
`Providers` integra `useWebSocket` + `urgentStore` con el token del authStore.
Fase 9 completada: Scheduler de cierre automatico + suite de tests final.
`scheduler/scheduler/main.py` ahora ejecuta UPDATE real a Postgres con
`make_interval(days => :dias)` y cron configurable. Tests con `pytest-asyncio`,
DB de test aislada (`helpdesk_test`), fixtures de sesion limpia por test y
override del engine de la app. Cobertura: auth (10), tickets (10), comentarios
(4), scheduler (4), smoke (2) = 30 tests, todos verdes.
Proxima fase: Fase 10 (deploy en Linux + distribucion de CA Caddy).
Fase 10 completada: Deploy en Ubuntu Server + acceso movil.

- `docker-compose.yml` base: Caddy en redes `internal` + `proxy` para resolucion DNS
  correcta de servicios internos (evita `connection refused` entre Caddy y frontend).
- `docker-compose.prod.yml`: `NEXT_PUBLIC_API_URL=""` en build args para rutas relativas
  (evita CORS entre HTTPS/desktop y HTTP/movil). Build sin cache para frontend y backend.
- `Caddyfile`: dos bloques — `:80 { ... }` para HTTP (movil por IP) y
  `helpdesk.local { ... }` para HTTPS (desktop con TLS). Ruta `/ca.crt` para descargar
  root CA desde el navegador. `handle /api/*` (sin strip de prefijo) para proxy a backend.
- `frontend/Dockerfile`: `ARG`/`ENV` para `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_WS_URL`
  antes del `npm run build` (las variables Next.js se queman en el bundle).
- `frontend/src/lib/api.ts`: `??` en lugar de `||` para que `baseURL=""` funcione
  correctamente con axios (rutas relativas al mismo origen).
- `frontend/src/app/providers.tsx`: WebSocket URL dinamico desde `window.location`
  (funciona en desktop HTTPS y movil HTTP automaticamente). Se elimina
  `NEXT_PUBLIC_WS_URL` del build args en prod para que SIEMPRE use el fallback
  `window.location.host` (asi el mismo bundle sirve para LAN y para Cloudflare
  Tunnel sin recompilar).
- `backend/app/core/config.py`: CORS origins incluye `https://helpdesk.local`,
  `http://192.168.1.9` y `http://localhost:3000`.
- `.env` produccion: `COOKIE_SECURE=false` para que las cookies de sesion funcionen
  en HTTP movil. `APP_ENV=prod`.
- Instalacion de root CA de Caddy en clientes (Windows, Android, iOS).
Fase 11 completada: Cloudflare Tunnel + Zero Trust (free tier).
- Servicio `cloudflared` en `docker-compose.yml` (profile prod, no publica
  puertos; conexion outbound a Cloudflare). Requiere `CLOUDFLARE_TUNNEL_TOKEN`
  en `.env`. Ingress publico: `https://soporte.tudominio.com` -> `caddy:80`.
- Caddy se mantiene como reverse proxy interno con TLS auto-firmado; el
  certificado valido para el usuario final es el de Cloudflare.
- Zero Trust Access: One-Time PIN por email (gratis, sin IdP externo). El
  operador debe configurar la policy en el dashboard y agregar los emails
  autorizados (max 50 usuarios en el tier free).
- WebSocket keepalive: `useWebSocket.ts` envia `{type:"ping"}` cada 60s para
  evitar el idle timeout de Cloudflare (100s no configurable en free tier).
- CORS agrega `https://soporte.tudominio.com` en `config.py`. `COOKIE_SECURE`
  puede pasar a `true` en `.env` (todo el trafico externo es HTTPS).
Fase 12 completada: PWA instalable.
- `frontend/public/manifest.json` con name, short_name, icons (192, 512,
  maskable 512), shortcuts a /tickets y /tickets/nuevo, display standalone.
- `frontend/public/sw.js` con estrategia mixta: network-first para HTML y
  navegacion, cache-first para `/_next/static/*` e iconos, network-only para
  `/api/*`, bypass total para `/ws` y WebSockets. Versionado por
  `CACHE_VERSION` para invalidar al desplegar.
- Iconos PNG generados por `scripts/generate_pwa_icons.py` (Pillow): 16, 32,
  48, 192, 512, maskable-512, apple-touch 180. Diseno simple ticket azul
  (#2563eb) - reemplazar cuando se tenga logo oficial.
- `frontend/src/components/ServiceWorkerRegister.tsx`: registra el SW solo
  en produccion (`process.env.NODE_ENV !== "production"` saltea el registro).
- `frontend/src/app/layout.tsx`: meta tags `apple-mobile-web-app-*`,
  `mobile-web-app-capable`, `theme-color`, manifest link, icon links.
- `frontend/next.config.js`: headers custom para `/sw.js` (no-cache +
  `Service-Worker-Allowed: /`) y `/manifest.json` (Content-Type correcto).
- `frontend/Dockerfile`: agregado `COPY --from=builder /app/public ./public`
  porque el output `standalone` NO copia `public/` automaticamente.
- Resultado: en Chrome mobile aparece el banner "Agregar a pantalla de
  inicio". En iOS Safari: Compartir > Agregar a pantalla de inicio.
Fase 13 completada: Web Push notifications (VAPID self-hosted).
- Backend: tabla `push_subscriptions` (UUID, usuario_id FK CASCADE, endpoint
  UNIQUE, p256dh_key, auth_key, user_agent, ultimo_envio_at). Migracion
  `a9b8c7d6e5f4`.
- Backend: `services/push_service.py` con `send_push_to_user` y
  `send_push_to_users`. Usa `pywebpush` + VAPID PEM. Cachea conversion
  raw-base64url -> PEM en el primer uso. Limpia suscripciones 404/410 Gone.
- Backend: `routers/push.py` expone `GET /api/push/vapid-public-key`,
  `GET /api/push/subscriptions`, `POST /api/push/subscribe`,
  `DELETE /api/push/subscribe`.
- Backend: `websockets/pubsub.py` ahora dispatcha push en paralelo al WS.
  Usa `manager.get_connected_user_ids()` para excluir usuarios ya
  conectados (evita notificacion doble).
- Backend: nuevo evento `ticket:assigned` (publicado por
  `ticket_service.asignar()` ademas del `ticket:updated` existente).
  El dispatcher lo enruta como push al usuario asignado.
- Backend: VAPID keys generadas una vez con cryptography (EC P-256). Las
  raw keys se guardan en `.env` como base64url; el PEM se deriva en
  runtime y se cachea.
- Frontend: `lib/notifications.ts` con `subscribeToPush`, `unsubscribeFromPush`,
  `isCurrentlySubscribed`, `isPushSupported`. Maneja permiso, conversion
  VAPID key a ArrayBuffer, registro de SW.
- Frontend: `hooks/useNotificationPermission.ts` con estado reactivo
  (`unsupported` | `loading` | `inactive` | `active` | `denied`).
- Frontend: `components/NotificationSettings.tsx` con toggle y lista de
  devices suscritos. Accesible via boton flotante (gear) en panel layout.
- Frontend: `sw.js` con handlers `push` (parsea payload JSON, muestra
  `Notification` con icon y badge) y `notificationclick` (foco/abre la
  URL del ticket, con fallback a `clients.openWindow`).
- Eventos que disparan push: `ticket:urgent_created` (a roles
  agente+administrador no conectados), `ticket:assigned` (al agente
  asignado si no esta conectado).
- Limite: iOS Safari solo recibe push si la PWA esta instalada (iOS 16.4+).
  No es objetivo actual.
- Proximas fases: 14 (WARP client para SSH al server).

Fase 14 (revisada): Notificaciones push unificadas via PWA + Web Push.

- Se elimino el proyecto Capacitor/Android/iOS (app nativa) en favor de
  la PWA instalable con Web Push VAPID como unico canal de push.
- Backend: `services/push_service.py` simplificado a solo Web Push (VAPID
  via pywebpush). Se removio firebase-admin y FCM.
- Backend: `core/config.py` sin `firebase_credentials_path`.
- Backend: `routers/push.py` y `schemas/push.py` simplificados (solo web).
- Backend: `models/push_subscription.py` sin `PushPlatform` enum ni
  `is_native`/`is_web` (la columna `plataforma` se conserva en DB por
  compatibilidad con la migracion existente).
- Frontend: `lib/notifications.ts` sin deteccion de Capacitor.
- Frontend: `lib/capacitor/` eliminado. Deps `@capacitor/core` y
  `@capacitor/push-notifications` removidos de `package.json`.
- `mobile/` eliminado por completo.
- `.gitignore`: entradas de Capacitor/Firebase removidas.
- `docker-compose.yml`: volume mount de `firebase-credentials.json` removido.
- Push notifications funcionan en: Chrome, Edge, Firefox (desktop y mobile
  con PWA instalada). iOS Safari requiere PWA instalada (iOS 16.4+).
- Proximas fases: 15 (WARP client para SSH al server).

Fase 15 completada: Adjuntos solo imagenes + optimizacion + lightbox + proxy auth.

- Backend `adjunto_service.py`: whitelist de MIME `image/jpeg|image/png|image/webp`
  + validacion de magic bytes (defensa contra Content-Type spoofing) + validacion
  de extension (.jpg/.jpeg/.png/.webp). Limite 10 MB mantenido.
- Backend `core/storage.py`: simplificado a `get_s3` + `ensure_bucket` (sin
  signed URLs; el proxy por backend es la unica via de acceso).
- Backend `routers/adjuntos.py`: nuevo endpoint `GET /api/tickets/{tid}/adjuntos/{adj_id}/archivo`
  que valida sesion + tenant (cliente solo su ticket, agente asignado, admin todo)
  y streama el binario de MinIO via `s3.get_object()`. Soporta header `Range`
  para carga progresiva (responde 206). Headers: `Content-Type` desde la DB,
  `Cache-Control: private, max-age=3600` (cache del navegador).
- Backend `services/adjunto_service.py`: `_to_out()` ahora genera `archivo_url`
  como **ruta RELATIVA** `/api/tickets/{tid}/adjuntos/{adj_id}/archivo`. El
  navegador la resuelve contra `window.location.origin`, asi funciona
  identico en LAN (<https://helpdesk.local>) y Cloudflare Tunnel
  (<https://soporte.gmpredes.online>) sin config ni CORS. Tambien nueva
  funcion `stream_archivo()` que hace `s3.get_object` (con Range opcional)
  y devuelve dict con body/media_type/content_range.
- Backend `core/config.py`: removidas `minio_public_endpoint` y
  `minio_signed_url_ttl` (ya no se usan).
- Frontend `lib/imageUtils.ts` (nuevo): `optimizeImage(file)` redimensiona a
  max 1920px en el lado mayor y re-comprime a WebP 80% usando Canvas API nativa
  (sin dependencias). `isImageMime()`, `formatBytes()`, `ALLOWED_IMAGE_MIME/ACCEPT`.
- Frontend `lib/adjuntoBlob.ts` (nuevo): cache compartido de blob URLs en
  memoria. `fetchAdjuntoBlob(url, token)` hace `fetch()` con Authorization,
  convierte a Blob y crea `URL.createObjectURL`. Dedup de requests en vuelo
  (`inflight` Map). `evictAdjuntoBlob()` libera memoria al borrar.
- Frontend `hooks/useAdjuntoBlob.ts` (nuevo): hook que envuelve `fetchAdjuntoBlob`
  y retorna `{ url, loading, error }`. Re-fetch automatico si cambia el token.
- Frontend `components/AdjuntosGallery.tsx` (nuevo): grid 2-3 columnas con
  thumbnails (object-cover, lazy, loading spinner), hover overlay con
  nombre/tamano, boton borrar. Lightbox modal con navegacion ← →, contador
  posicion, cerrar con ESC o click fuera, max 90vw x 85vh. Spinner de progreso
  durante optimizacion/subida. Mensajes de error especificos.
- Frontend `app/(panel)/tickets/[id]/page.tsx`: la seccion de adjuntos ahora
  usa `<AdjuntosGallery>`. Eliminado `subirAdjunto` inline (movido al componente).
  Resto del archivo sin cambios.
- Caddy: ELIMINADO `handle /storage/*` (ya nadie accede a MinIO directo desde
  el navegador; todo va por el proxy del backend con auth).
- `.env.example`: removidas `MINIO_PUBLIC_ENDPOINT` y `MINIO_SIGNED_URL_TTL`.
- Tests `tests/test_adjuntos.py` (nuevo, 11 tests): parchea `get_s3` con mock
  que tiene `upload_fileobj`, `delete_object`, `get_object`. Cubre:
  - Validacion de subida: `test_rechaza_pdf`, `test_rechaza_jpeg_con_extension_falsa`,
    `test_rechaza_jpeg_con_magic_bytes_invalidos`, `test_acepta_jpeg_valido`,
    `test_acepta_png_valido`, `test_listar_devuelve_ruta_relativa`
  - Descarga con auth: `test_descarga_archivo_con_sesion`, `test_descarga_sin_sesion_401`,
    `test_cliente_otra_empresa_403`, `test_stream_con_range_206`
- Verificado: `ruff check` limpio en archivos modificados, `mypy` sin issues,
  `tsc --noEmit` pasa, `eslint` sin warnings.
- **Fix de imagenes con 401**: el `<img src>` no envia header `Authorization`,
  por lo que el backend rechaza con 401. Solucion: `useAdjuntoBlob` hace
  `fetch()` con Bearer, convierte a Blob y muestra via `URL.createObjectURL`.
  Cache en memoria evita re-fetch al navegar thumbnails/lightbox.
- Proximas fases: 16 (WARP client para SSH al server).

Fase 16 completada: Notificacion de cambio de estado para clientes.

- Backend `services/ticket_service.py`: nueva funcion `_publicar_cambio_estado()`
  que emite evento `ticket:state_changed` con `estado_anterior` y `estado_nuevo`.
  Se llama en `cambiar_estado()` y `reabrir()` ademas del `ticket:updated`
  existente.
- Frontend `store/urgentStore.ts`: `AlertKind` incluye `"state_changed"`.
  `UrgentAlert` tiene campos opcionales `estado_anterior` y `estado_nuevo`.
- Frontend `store/wsTicketStore.ts`: nueva interfaz `TicketStateChangedEvent`
  con `estado_anterior`, `estado_nuevo`. Handler `onTicketStateChanged`.
- Frontend `components/UrgentToasts.tsx`: tarjeta verde para `state_changed`
  con icono de reciclaje, muestra `estado_anterior → estado_nuevo`, clickeable
  al ticket. Beep a 770Hz (intermedio entre asignacion 660Hz y urgente 880Hz).
- Frontend `app/providers.tsx`: handler `ticket:state_changed` que muestra toast
  y `Notification` del browser cuando `cliente_id === usuario.id` (solo al dueño
  del ticket).
- Verificado: `ruff check` limpio, `tsc --noEmit` pasa, `eslint` sin warnings
  nuevos.

Fase 17 completada: Backup automatizado + systemd auto-restart.

- `scripts/backup.sh`: backup completo de PostgreSQL (pg_dump), MinIO (tar)
  y Redis (BGSAVE + dump.rdb). Soporta `--restore YYYYMMDD_HHMMSS`.
  Limpieza automatica de backups mayores a 7 dias. Verifica espacio en disco.
  Manifest JSON con metadata del backup.
- `deploy/helpdesk.service`: unit systemd tipo `oneshot` con
  `RemainAfterExit=yes`. `ExecStart` levanta el stack prod,
  `ExecStop` lo detiene. `WantedBy=multi-user.target` para auto-restart
  en boot. `StartLimitBurst=3` con `StartLimitIntervalSec=300`.
- `AGENTS.md`: documentados comandos de backup, restore y systemd.

Fase 18 completada: Emails transaccionales via Resend + exclusion de agentes de urgentes.

- Backend `services/email_service.py` (nuevo): cliente Resend via httpx async
  contra `POST https://api.resend.com/emails` con Bearer `RESEND_API_KEY`.
  Funciones: `send_ticket_created`, `send_ticket_closed`, `send_ticket_urgent`.
  Fire-and-forget via `asyncio.create_task` (no bloquea la respuesta HTTP).
  Si `RESEND_API_KEY` vacio, el servicio se desactiva silenciosamente.
  Reintentos con backoff exponencial: 4 intentos max (delays 2s, 4s, 8s) solo
  para errores de red (`httpx.ConnectError`, `httpx.TimeoutException`). Errores
  4xx de la API no se reintentan. Previene bucles infinitos y consumo excesivo
  de peticiones.
- Backend `core/config.py`: settings `resend_api_key`, `resend_from_email`,
  `resend_urgent_recipients` (string CSV).
- Backend `services/ticket_service.py`:
  - `crear()` y `crear_admin()` llaman `_enviar_emails_post_creacion()` despues
    del commit (cliente recibe confirmacion; si urgente, recipients CSV reciben
    alerta).
  - `cambiar_estado()` llama `_enviar_email_resolucion()` cuando nuevo estado es
    `resuelto` (NO en `cerrado`, para evitar duplicado cuando el cliente
    confirma el cierre).
- Backend `websockets/pubsub.py:101-106` y `services/ticket_service.py:124-131`:
  removido `RolUsuario.agente.value` de la lista de `ticket:urgent_created`
  (agentes no se notifican pq no pueden autoasignarse). Docstring del
  dispatcher tambien actualizado.
- `.env.example`: documentadas las 3 variables de Resend.
- Tests `tests/test_email_service.py` (nuevo, 10): cubre API key vacia,
  multiples recipients urgentes, rechazo de Resend, excepciones de red,
  payload correcto.
- Tests `tests/test_tickets.py` (+4): verifican que `send_ticket_created`,
  `send_ticket_urgent` y `send_ticket_closed` se invocan; y que la lista
  de roles del evento urgente excluye al rol agente.
- Resultado: 75 tests verdes, ruff limpio en archivos modificados.

Auditoria de seguridad multi-tenant y transaccional (Fixes A-G).

- **A (CRITICO)** `puntos_venta` GET no aplicaba `tenant_filter`: un cliente
  podia listar puntos de venta de cualquier empresa. Fix: `listar`,
  `listar_por_empresa` y `obtener` ahora reciben `current` y filtran por
  `empresa_id` del tenant. `listar_por_empresa` rechaza (403) si el cliente
  pide una empresa ajena.
- **B (ALTO)** `ticket_service.obtener` no restringia a agentes: un agente
  podia ver tickets no asignados a el (contradecia AGENTS.md Fase 5). Fix:
  anadido check `agente_id == current.id` para rol agente (cascada a
  comentarios, adjuntos, historial, patches).
- **C (ALTO)** `ticket_service.listar` auto-filtro del agente solo aplicaba
  si `agente_id is None`; un agente podia evadirlo pasando
  `?agente_id=<otro>`. Fix: auto-filtro ahora incondicional para rol agente;
  el parametro `agente_id` solo se aplica para otros roles.
- **D (ALTO)** `ticket_service.actualizar` y `cambiar_prioridad` no validaban
  asignacion del agente. Fix: agente no asignado -> 403.
- **E (ALTO)** `comentario_service.crear` hacía dos commits (comentario +
  `fecha_primera_respuesta`); si el segundo fallaba, el comentario quedaba
  sin marca FRT. Fix: un solo commit tras ambos writes.
- **F (ALTO)** `adjunto_service.eliminar` no validaba
  `adjunto.ticket_id == ticket_id` del path (el GET de descarga si lo hacia).
  Fix: el servicio ahora recibe `ticket_id` y valida coincidencia.
- **G (MEDIO)** `usuario_service.actualizar` podia dejar un usuario con
  rol `cliente` sin `empresa_id` (solo validaba si `empresa_id` venia en el
  payload). Fix: si el rol resultante es `cliente` y no hay `empresa_id`
  (ni en payload ni en el usuario existente) -> 409.
- Verificacion: `py_compile` limpio en todos los archivos modificados;
  app recarga sin errores; 75 endpoints intactos.

Optimizacion de performance (Fixes H-K).

- **H (MEDIO)** `routers/stats.py`: reemplazadas 7 queries COUNT
  separadas por 1 `GROUP BY estado` + 1 COUNT para urgentes (2
  round-trips en lugar de 7). Filtros tenant+agente extraidos a
  helper `_base_filters` reutilizable.
- **I (MEDIO)** `services/comentario_service.py:listar`: eliminado
  N+1 (un `SELECT Usuario` por comentario) reemplazandolo por un
  `outerjoin(Usuario)` en la query principal.
- **J (MEDIO)** `services/tarea_pendiente_service.py:listar`:
  eliminado N+1 (un `SELECT Ticket` por tarea) reemplazandolo por un
  `outerjoin(Ticket)` en la query principal.
- **K (MEDIO)** `core/storage.py`: anadidos wrappers async
  (`s3_upload_fileobj`, `s3_get_object`, `s3_delete_object`,
  `ensure_bucket_async`) que delegan al cliente boto3 sincrono via
  `asyncio.to_thread()`. `adjunto_service.py` y `main.py` ahora usan
  los wrappers async; las llamadas S3 ya no bloquean el event loop.

Mejoras de validacion / integridad (Fixes menores 1-7).

- **1** `utils/pagination.py`: `paginacion()` clampeaba `size` a max
  90, pero los routers declaran `le=100`. Unificado a 100.
- **2** `services/empresa_service.py`: `crear` y `actualizar` ahora
  validan unicidad de nombre (409), consistente con categorias,
  subcategorias y puntos_venta.
- **3** `services/matriz_prioridad_service.py:sincronizar_categoria`:
  ahora valida que `categoria_id` exista (404) y que los
  `subcategoria_id` pertenezcan a esa categoria (409), antes de
  ejecutar el DELETE+INSERT destructivo.
- **4** `services/tarea_pendiente_service.py:crear`: validaba
  existencia del ticket sin tenant. Ahora usa
  `ticket_service.obtener` que aplica `tenant_filter` + restriccion
  de agente asignado.
- **5** `services/adjunto_service.py:subir`: `object_key` ahora usa
  la extension real del MIME (`.jpg`/`.png`/`.webp`) via
  `MIME_TO_EXT`, en vez de siempre `.webp`.
- **6** `services/adjunto_service.py:stream_archivo` +
  `routers/adjuntos.py`: `Content-Disposition` ahora usa
  `nombre_archivo` real en vez del UUID del adjunto.
- **7** `services/comentario_service.py:_resolve_implicated_user_ids`:
  admins notificados se filtran por `empresa_id == ticket.empresa_id`
  o `empresa_id IS NULL` (admins globales), evitando notificar a
  admins de otras empresas (data leak por metadata).
- Verificacion: `py_compile` limpio en todos los archivos
  modificados; app recarga sin errores; 75 endpoints intactos.

Optimizacion de performance (Fixes L-N, monitoring-driven).

Contexto: los dashboards de Grafana detectaron endpoints lentos
(P95: `/api/empresas` 2.13s, `/api/stats` 967ms, `/api/tickets`
887ms). La auditoria confirmo que los 3 endpoints hacen pocas
queries (3 round-trips, sin N+1); el cuello era transversal.

- **L** `core/database.py`: `pool_size` 5 -> 15 y `max_overflow`
  10 -> 5 (4 workers x 20 = 80 conns < `max_connections=100` de
  Postgres). El P95 de los endpoints del dashboard se inflaba por
  espera de conexion del pool cuando corrían en paralelo los
  endpoints pesados (`/api/metricas/*`, `/api/reportes/*`).
- **M** Nueva migracion `aa11bb22cc33`: indices
  `idx_tickets_cliente`, `idx_tickets_fecha_creacion`,
  `idx_tickets_empresa_fecha` (empresa_id, fecha_creacion) e
  `idx_usuarios_empresa`. Reflejados en los models Usuario y
  Ticket.
- **N** `/api/tickets` ORDER BY no SARGable (2 `case()` dinamicos
  por estado/prioridad) reemplazado por columna generada
  persistida `tickets.peso_orden SMALLINT`
  (`CASE estado * 10 + CASE prioridad`, autocalculada por la DB
  en cada UPDATE de estado/prioridad, cero riesgo de
  desincronizado) + indice `(peso_orden, fecha_creacion)`.
  Equivalencia de orden verificada fila por fila contra el CASE
  viejo y benchmark en PG16 con 50k filas: page-read
  9.35ms (seq scan + sort) -> 0.082ms (index scan, sin sort).
  `orden="prioridad"` pasa a ser sinonimo del default.
- Verificacion: `py_compile` limpio; `ruff check/format` (0.6.9)
  limpio; expresion de `peso_orden` + equivalencia de orden +
  uso del indice validados en un PostgreSQL 16 real.
