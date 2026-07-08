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
  (funciona en desktop HTTPS y movil HTTP automaticamente).
- `backend/app/core/config.py`: CORS origins incluye `https://helpdesk.local`,
  `http://192.168.1.8` y `http://localhost:3000`.
- `.env` produccion: `COOKIE_SECURE=false` para que las cookies de sesion funcionen
  en HTTP movil. `APP_ENV=prod`.
- Instalacion de root CA de Caddy en clientes (Windows, Android, iOS).
