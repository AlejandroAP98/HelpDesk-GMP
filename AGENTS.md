# AGENTS.md - Guia para agentes y desarrolladores

## Comandos del proyecto

### Docker (desarrollo)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build   # levantar
docker compose -f docker-compose.yml -f docker-compose.dev.yml down             # parar
docker compose logs -f backend frontend                                          # logs
```

### Backend (Python + Poetry)

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
