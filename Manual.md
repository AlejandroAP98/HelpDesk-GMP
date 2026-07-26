# HelpDesk GMP — Manual del Sistema

---

## Índice

1. [Manual del Sistema](#1-manual-del-sistema)
2. [Manual para Clientes](#2-manual-para-clientes)
3. [Manual para Administradores](#3-manual-para-administradores)

---

# 1. Manual del Sistema

## 1.1 Visión General

HelpDesk GMP es un sistema de gestión de tickets de soporte técnico diseñado para empresas de telecomunicaciones. Permite a clientes reportar incidentes y a agentes/administradores gestionar su resolución a través de un flujo de trabajo con máquina de estados, notificaciones en tiempo real (WebSocket), notificaciones push (Web Push VAPID), y alertas por email.

### Arquitectura

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS + Zustand |
| Backend | Python 3.12 + FastAPI + SQLAlchemy 2 async + Pydantic v2 |
| Base de datos | PostgreSQL 16 (pgcrypto, asyncpg) |
| Cache / Tiempo real | Redis 7 (Pub/Sub + WebSockets) |
| Almacenamiento de archivos | MinIO (S3-compatible) |
| Proxy reverso | Caddy 2 (TLS auto-firmado en LAN) |
| Túnel externo | Cloudflare Tunnel (opcional, perfil prod) |
| Orquestación | Docker Compose |

## 1.2 Roles del Sistema

| Rol | Descripción |
|---|---|
| `cliente` | Usuario final de una empresa. Crea tickets y da seguimiento. |
| `agente` | Técnico de soporte. Ve solo los tickets asignados a él. |
| `mesa_ayuda` | Nivel jerárquico superior. Ve todos los tickets y puede asignar. |
| `administrador` | Acceso total al sistema: CRUD de empresas, usuarios, categorías, etc. |

## 1.3 Infraestructura Docker

### Entorno de desarrollo

```bash
# Levantar servicios
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

# Detener servicios
docker compose -f docker-compose.yml -f docker-compose.dev.yml down

# Ver logs
docker compose logs -f backend frontend
```

### Entorno de producción (Linux)

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod up -d --build
```

### Servicios

| Servicio | Puerto (dev) | Descripción |
|---|---|---|
| `postgres` | 5432 | Base de datos PostgreSQL 16 |
| `redis` | 6379 | Redis 7 para Pub/Sub + caché |
| `minio` | 9000 (API), 9001 (console) | Almacenamiento S3 para adjuntos |
| `backend` | 8000 | API FastAPI + WebSockets |
| `frontend` | 3000 | Next.js SSR |
| `scheduler` | — | APScheduler para cierre automático |
| `caddy` | 80, 443 | Proxy reverso (solo prod) |
| `cloudflared` | — | Túnel Cloudflare (solo prod) |

## 1.4 Estados de Ticket (Máquina de Estados)

```
abierto → asignado → en_progreso → resuelto → cerrado
```

- **abierto**: Ticket creado, esperando asignación.
- **asignado**: Un agente ha sido asignado.
- **en_progreso**: El agente está trabajando en él.
- **resuelto**: Solución aplicada, esperando confirmación del cliente.
- **cerrado**: Estado final. El ticket no se puede modificar.

Las transiciones son estrictas y se validan en el backend. No se puede saltar estados ni retroceder.

## 1.5 Elementos de Infraestructura

Los tickets pueden afectar a uno de estos elementos:

- **Torre** — Estructura de telecomunicaciones.
- **Celda** — Sector de cobertura en una torre.
- **Mástil** — Soporte para antenas.
- **Punto de venta** — Local comercial del cliente.

## 1.6 Prioridades

| Prioridad | Descripción |
|---|---|
| `baja` | Sin impacto crítico. |
| `media` | Impacto moderado. |
| `alta` | Impacto significativo. |
| `urgente` | Servicio caído o crítica. Genera alerta sonora + push + email. |

La prioridad se calcula automáticamente según la **matriz de prioridad** configurable por administrador (combinación de categoría + subcategoría + elemento).

## 1.7 APIs REST

### Autenticación (`/api/auth`)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/register` | Registro de cliente |
| POST | `/api/auth/register/agente` | Crear agente/admin (requiere admin) |
| POST | `/api/auth/login` | Iniciar sesión |
| POST | `/api/auth/refresh` | Refrescar token |
| GET | `/api/auth/me` | Perfil del usuario actual |
| PATCH | `/api/auth/me` | Actualizar perfil propio |
| POST | `/api/auth/change-password` | Cambiar contraseña |

### Tickets (`/api/tickets`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/tickets` | Listar tickets (con filtros) |
| POST | `/api/tickets` | Crear ticket |
| GET | `/api/tickets/{id}` | Detalle del ticket |
| PATCH | `/api/tickets/{id}` | Actualizar ticket (admin) |
| PATCH | `/api/tickets/{id}/estado` | Cambiar estado |
| PATCH | `/api/tickets/{id}/asignar` | Asignar agente |
| POST | `/api/tickets/{id}/asignarme` | Auto-asignarse |
| PATCH | `/api/tickets/{id}/reabrir` | Reabrir ticket cerrado |
| GET | `/api/tickets/{id}/historial-estados` | Historial de cambios de estado |
| GET | `/api/tickets/exportar-csv` | Exportar tickets a CSV |

### Comentarios (`/api/tickets/{id}/comentarios`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/tickets/{id}/comentarios` | Listar comentarios |
| POST | `/api/tickets/{id}/comentarios` | Agregar comentario (público o nota interna) |

### Adjuntos (`/api/tickets/{id}/adjuntos`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/tickets/{id}/adjuntos` | Listar adjuntos |
| POST | `/api/tickets/{id}/adjuntos` | Subir imagen (JPEG, PNG, WebP, máx 10 MB) |
| GET | `/api/tickets/{id}/adjuntos/{adj_id}/archivo` | Descargar archivo (soporta Range) |
| DELETE | `/api/tickets/{id}/adjuntos/{adj_id}` | Eliminar adjunto |

### Admin

| Método | Ruta | Descripción |
|---|---|---|
| CRUD | `/api/empresas` | Gestión de empresas (admin) |
| CRUD | `/api/usuarios` | Gestión de usuarios (admin) |
| CRUD | `/api/categorias` | Gestión de categorías (admin crea/edita/borra) |
| CRUD | `/api/subcategorias` | Gestión de subcategorías (admin) |
| CRUD | `/api/puntos-venta` | Gestión de puntos de venta (admin) |
| CRUD | `/api/respuestas-rapidas` | Respuestas predefinidas (agente+) |
| CRUD | `/api/tareas` | Tareas pendientes (agente+) |
| GET/PUT | `/api/matriz-prioridad` | Matriz de prioridad (admin) |

### Estadísticas y Métricas

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/stats` | Dashboard counts (total, por estado, urgentes) |
| GET | `/api/metricas/tiempos` | Tiempos promedio/máximo de resolución |
| GET | `/api/metricas/volumen` | Volumen por empresa y tiempo |
| GET | `/api/metricas/infraestructura` | Desglose por elemento |
| GET | `/api/metricas/rendimiento-agente` | Rendimiento de agentes |
| GET | `/api/metricas/tiempo-por-agente` | MTTR por agente |
| GET | `/api/metricas/reaperturas` | Tickets reabiertos |
| GET | `/api/metricas/sla` | Cumplimiento de SLA |
| GET | `/api/reportes/tickets/csv` | Reporte CSV completo |

### Push Notifications

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/push/vapid-public-key` | Obtener clave VAPID pública |
| GET | `/api/push/subscriptions` | Listar suscripciones del usuario |
| POST | `/api/push/subscribe` | Suscribirse a push |
| DELETE | `/api/push/subscribe` | Desuscribirse |
| DELETE | `/api/push/subscriptions/all` | Eliminar todas las suscripciones |
| POST | `/api/push/test` | Enviar push de prueba |

### WebSocket

```
ws://host:8000/ws?token=<JWT>
```

### Health Check

```
GET /health
```

## 1.8 Eventos en Tiempo Real (WebSocket + Push)

El sistema utiliza Redis Pub/Sub para distribuir eventos a todos los backend, que a su vez los reenvían por WebSocket a los clientes conectados y, si el usuario no está conectado, como notificación push (Web Push).

| Evento | Disparo | Push | Destinatarios |
|---|---|---|---|
| `ticket:urgent_created` | Ticket urgente creado | Sí | mesa_ayuda + admin |
| `ticket:new` | Ticket creado | Sí | mesa_ayuda + admin |
| `ticket:assigned` | Agente asignado | Sí | Al agente asignado |
| `ticket:updated` | Ticket actualizado | No | Sala del ticket + broadcast |
| `ticket:state_changed` | Cambio de estado | No | Sala del ticket + broadcast |
| `ticket:commented` | Nuevo comentario | No | Sala del ticket |
| `ticket:deleted` | Ticket eliminado | No | Broadcast |

El keepalive del WebSocket envía `{"type":"ping"}` cada 60 segundos para evitar timeouts (Cloudflare: 100s).

## 1.9 Notificaciones Push (Web Push VAPID)

- **Protocolo**: Web Push con VAPID (Voluntary Application Server Identification).
- **Base de datos**: Tabla `push_subscriptions` con endpoint, claves y user_agent.
- **Máximo**: 5 suscripciones por usuario.
- **Limpieza automática**: Suscripciones 404/410 Gone se eliminan automáticamente; suscripciones inactivas >30 días se limpian.
- **Eventos que disparan push**:
  - `ticket:urgent_created` — A todos los usuarios de mesa_ayuda y admin (no agentes).
  - `ticket:new` — A mesa_ayuda y admin.
  - `ticket:assigned` — Exclusivamente al agente asignado.
- **Smart dispatch**: Si el usuario está conectado por WebSocket, NO recibe push (evita duplicados).

## 1.10 Adjuntos (Subida de Imágenes)

- **Formatos permitidos**: JPEG (`.jpg`, `.jpeg`), PNG (`.png`), WebP (`.webp`).
- **Tamaño máximo**: 10 MB por archivo.
- **Validación**: MIME type + magic bytes (defensa contra spoofing).
- **Optimización desde frontend**: Redimensiona a máx 1920px en el lado mayor y comprime a WebP 80% antes de subir.
- **Acceso**: Vía proxy del backend con autenticación (no acceso directo a MinIO).
- **Cache**: El navegador cachea por 1 hora (`Cache-Control: private, max-age=3600`).
- **Soporte Range**: Carga progresiva de imágenes grandes (responde 206 Partial Content).

## 1.11 Servicio de Email (Resend)

- **API**: Resend (`POST https://api.resend.com/emails`) con `httpx.AsyncClient`.
- **Modo fire-and-forget**: Las llamadas no bloquean la respuesta HTTP.
- **Desactivación**: Si `RESEND_API_KEY` está vacío, el servicio se desactiva silenciosamente.
- **Correos enviados**:
  - Confirmación de creación de ticket al cliente.
  - Notificación de resolución al cliente.
  - Alerta urgente a los destinatarios configurados en `RESEND_URGENT_RECIPIENTS`.

## 1.12 Programador de Cierre Automático (Scheduler)

- **Ejecuta**: Diariamente a las 2:00 AM (configurable vía `SCHEDULER_CLOSE_TICKETS_CRON`).
- **Acción**: Cierra tickets en estado `resuelto` que no hayan tenido actividad en los últimos 7 días (configurable vía `TICKET_AUTO_CLOSE_DAYS`).
- **Implementación**: Microservicio independiente con APScheduler, conexión directa a PostgreSQL.

## 1.13 Sincronización de Puntos de Venta (Supabase)

```bash
# Sincronizar sedes desde Supabase (GMP) a la tabla puntos_venta
docker compose exec backend python -m scripts.sync_sedes_supabase

# Preview sin aplicar cambios
docker compose exec backend python -m scripts.sync_sedes_supabase --dry-run
```

Requiere `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en el `.env`.

## 1.14 Respaldo y Restauración

### Backup completo

```bash
./scripts/backup.sh
```

Respalda:

- PostgreSQL (pg_dump comprimido)
- MinIO (archivo tar del volumen)
- Redis (BGSAVE + dump.rdb comprimido)
- Configuración (.env + Caddyfile)

Genera un manifest JSON con metadatos. Los backups se almacenan en `/backups/helpdesk/`. Se conservan los últimos 7 días.

### Restaurar

```bash
./scripts/backup.sh --restore YYYYMMDD_HHMMSS
```

### Programar backup diario

```
0 3 * * * /opt/HelpDesk-GMP/scripts/backup.sh >> /var/log/helpdesk-backup.log 2>&1
```

## 1.15 PWA (Progressive Web App)

El sistema es instalable como PWA en dispositivos móviles y de escritorio.

- **Requisito**: El service worker solo se registra en producción.
- **Estrategia de caché**:
  - HTML: network-first con fallback a caché.
  - `/_next/static/*`: cache-first (assets versionados).
  - Iconos y manifest: cache-first.
  - `/api/*`: network-only (nunca cachear datos).
  - WebSocket: bypass.
- **Notificaciones**: El SW maneja `push` y `notificationclick` para abrir el ticket correspondiente.
- **Instalación**:
  - **Chrome mobile**: Aparece banner "Agregar a pantalla de inicio".
  - **iOS Safari**: Compartir > Agregar a pantalla de inicio (iOS 16.4+).

## 1.16 Variables de Entorno Principales

### JWT / Sesión

| Variable | Default | Descripción |
|---|---|---|
| `JWT_SECRET` | — | Clave secreta para firmar tokens |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Duración del token de acceso (minutos) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Duración del token de refresco (días) |
| `COOKIE_SECURE` | `false` | `true` en producción (HTTPS) |

### Email

| Variable | Default | Descripción |
|---|---|---|
| `RESEND_API_KEY` | — | API key de Resend |
| `RESEND_FROM_EMAIL` | `HelpDesk <noreply@helpdesk.local>` | Dirección remitente |
| `RESEND_URGENT_RECIPIENTS` | — | CSV de emails para alertas urgentes |

### Scheduler

| Variable | Default | Descripción |
|---|---|---|
| `TICKET_AUTO_CLOSE_DAYS` | `7` | Días para cierre automático |
| `SCHEDULER_CLOSE_TICKETS_CRON` | `0 2 * * *` | Expresión cron |

### VAPID (Push)

| Variable | Default | Descripción |
|---|---|---|
| `VAPID_PUBLIC_KEY` | — | Clave pública VAPID (base64url) |
| `VAPID_PRIVATE_KEY` | — | Clave privada VAPID (base64url) |

### Supabase

| Variable | Default | Descripción |
|---|---|---|
| `SUPABASE_URL` | — | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Service role key de Supabase |

### Cloudflare

| Variable | Default | Descripción |
|---|---|---|
| `CLOUDFLARE_TUNNEL_TOKEN` | — | Token del túnel Cloudflare |

## 1.17 Comandos Útiles

### Backend

```bash
# Tests
docker compose exec backend poetry run pytest

# Lint
docker compose exec backend poetry run ruff check app
docker compose exec backend poetry run ruff format app

# Type check
docker compose exec backend poetry run mypy app

# Migraciones
docker compose exec backend poetry run alembic revision --autogenerate -m "<mensaje>"
docker compose exec backend poetry run alembic upgrade head

# Seed inicial
docker compose exec backend python -m scripts.seed
```

### Frontend

```bash
docker compose exec frontend npm run lint
docker compose exec frontend npm run typecheck
docker compose exec frontend npm run build
```

---

# 2. Manual para Clientes

## 2.1 Acceso al Sistema

1. Abra su navegador web (Chrome, Edge, Firefox o Safari).
2. Ingrese a la dirección que le haya proporcionado el administrador:
   - En la red local: `https://helpdesk.local` o `http://<IP-del-servidor>`
   - Desde internet: `https://soporte.tudominio.com`
3. Verá la pantalla de inicio de sesión.

## 2.2 Inicio de Sesión

1. Ingrese su **correo electrónico** y **contraseña**.
2. Haga clic en **Ingresar**.
3. Si es la primera vez, el administrador debe haber creado su cuenta previamente. Si no tiene credenciales, contacte al administrador.

## 2.3 Pantalla Principal (Dashboard)

Al iniciar sesión verá un panel con:

- **Tarjetas de resumen**: Total de tickets, abiertos, urgentes, resueltos.
- **Tickets recientes**: Lista de los últimos 5 tickets creados.
- **Vista**: Puede alternar entre vista de **tarjetas** y **tabla**.

## 2.4 Crear un Nuevo Ticket

1. Haga clic en el botón **Nuevo ticket** (esquina superior derecha o en la barra lateral).
2. Complete el formulario:

   - **Título**: Describa brevemente el problema (máx 150 caracteres).
   - **Categoría**: Seleccione el tipo de problema (Ej: Conectividad, Hardware, Software).
   - **Subcategoría**: Seleccione una subcategoría específica.
   - **Elemento afectado**: Indique qué elemento de infraestructura está fallando:
     - Torre
     - Celda
     - Mástil
     - Punto de venta
   - **Descripción**: Explique el problema con detalle.
   - **Campos de red** (opcional): Active cada campo con el interruptor y complete:
     - IP's PC's
     - IP Antena
     - Máscara de red
     - Puerta de enlace
   - **Punto de venta**: Si el elemento es "Punto de venta", seleccione el local desde el buscador.
   - **Archivos adjuntos**: Puede adjuntar imágenes (JPEG, PNG, WebP, máx 10 MB por archivo).

3. Haga clic en **Crear ticket**.
4. Recibirá un correo de confirmación automático.

## 2.5 Consultar Tickets

1. En la barra lateral, haga clic en **Tickets**.
2. Use los filtros disponibles para buscar:
   - **Estado**: Abierto, Asignado, En progreso, Resuelto, Cerrado.
   - **Prioridad**: Baja, Media, Alta, Urgente.
   - **Vista**: Activos (default), Historial, Todos.
3. Cada ticket muestra: título, estado (con color), prioridad, fecha, empresa.

## 2.6 Ver Detalle de un Ticket

Haga clic en cualquier ticket para ver su detalle:

- **Información general**: Título, descripción, estado, prioridad, fechas.
- **Línea de tiempo**: Muestra las fechas clave: creación, asignación, primera respuesta, resolución.
- **Campos técnicos**: IPs, máscara de red, puerta de enlace (si se ingresaron).
- **Comentarios**: Historial de la conversación con el agente.
- **Adjuntos**: Galería de imágenes con vista previa y lightbox (haga clic para ampliar).
- **Historial de estados**: Línea de tiempo de todos los cambios de estado.

### Sección de comentarios

- Puede ver todos los comentarios públicos realizados por usted y los agentes.
- Para agregar un comentario, escriba en el campo de texto y haga clic en **Enviar**.
- No puede agregar notas internas (solo visibles por agentes/administradores).

## 2.7 Cambios de Estado que Puede Realizar

| Estado actual | Acción disponible |
|---|---|
| `resuelto` | Confirmar cierre (el ticket pasa a `cerrado`) |

Si el agente marca el ticket como **resuelto**, usted puede confirmar el cierre. Una vez cerrado, el ticket es estado final y no se puede modificar. Si el problema persiste, contacte al agente para que reabra el ticket.

## 2.8 Notificaciones en Tiempo Real

- **WebSocket**: Las actualizaciones de tickets llegan en tiempo real sin necesidad de recargar la página.
- **Notificaciones push** (si permite el permiso en el navegador):
  - Recibirá notificaciones cuando cambie el estado de sus tickets.
  - Si instaló la PWA, las notificaciones llegarán aunque el navegador esté cerrado.
- **Email**: Recibirá correos de confirmación al crear un ticket y cuando se resuelva.

## 2.9 Notificaciones Push (Web Push)

1. Haga clic en el icono de **engranaje** (esquina superior derecha del panel).
2. Se abrirá el modal de configuración de notificaciones.
3. Haga clic en **Activar notificaciones**.
4. El navegador le pedirá permiso — haga clic en **Permitir**.
5. Verá el dispositivo listado como suscrito.
6. Para desactivar, use el toggle o el botón **Desuscribir**.

## 2.10 Cerrar Sesión

Haga clic en su nombre en la barra lateral y seleccione **Cerrar sesión**, o use el botón de salida al final del menú de navegación.

## 2.11 Cambiar Contraseña

1. Haga clic en el icono de **engranaje** en el panel.
2. Seleccione la pestaña **Cambiar contraseña**.
3. Ingrese su contraseña actual y la nueva (mín 8 caracteres).
4. Confirme la nueva contraseña y guarde.

## 2.12 Instalar la PWA (Opcional)

### En Chrome/Edge (Android)

- Al visitar el sitio, aparecerá un banner "Agregar a pantalla de inicio".
- O use el menú del navegador > Compartir > Agregar a pantalla de inicio.

### En Safari (iOS)

- Toque el icono **Compartir** (cuadrado con flecha arriba).
- Desplácese y seleccione **Agregar a pantalla de inicio**.
- Requiere iOS 16.4+ para notificaciones push.

### Beneficios

- Icono en el inicio del dispositivo como una app nativa.
- Notificaciones push sin tener el navegador abierto.
- Interfaz sin barras de navegación del navegador.

---

# 3. Manual para Administradores

## 3.1 Roles y Permisos

| Rol | Permisos |
|---|---|
| `administrador` | Acceso total: CRUD empresas, usuarios, categorías, matriz de prioridad, puntos de venta, todos los tickets. |
| `mesa_ayuda` | Ver y asignar todos los tickets, CRUD respuestas rápidas y tareas, ver métricas. No puede gestionar empresas/usuarios/categorías. |
| `agente` | Ver solo tickets asignados, cambiar estados, comentar, usar respuestas rápidas y tareas. |
| `cliente` | Crear tickets, ver sus propios tickets, comentar. |

## 3.2 Gestión de Empresas

Desde el panel admin: **Administración > Empresas**

- **Crear**: Haga clic en **Nueva empresa**, ingrese nombre y guarde.
- **Editar**: Haga clic en el lápiz junto a la empresa.
- **Eliminar**: Haga clic en el icono de eliminar. **Atención**: Eliminar una empresa eliminará en cascada todos sus tickets y usuarios asociados.

## 3.3 Gestión de Usuarios

Desde **Administración > Usuarios** puede:

### Crear usuario (cliente)

Usar el formulario de registro desde el panel admin seleccionando el rol `cliente`.

### Crear agente/mesa_ayuda/administrador

Usar la opción **Nuevo usuario** y seleccionar el rol correspondiente. Se envía al sistema de autenticación interno.

### Listar y filtrar

Filtre por rol, empresa o busque por nombre/email.

### Editar

Puede cambiar nombre, email, rol y empresa de un usuario.

### Eliminar

No se puede eliminar un usuario si tiene tickets asociados (restricción por FK). Desactive o reasigne sus tickets primero.

## 3.4 Gestión de Categorías y Subcategorías

Desde **Administración > Categorías**:

1. **Crear categoría**: Ingrese un nombre y descripción.
2. **Agregar subcategoría**: Dentro de cada categoría, cree subcategorías (ej: Categoría "Conectividad" → Subcategorías "Internet lento", "Sin servicio", "Pérdida de paquetes").
3. **Editar/Eliminar**: Use los iconos correspondientes.

### Matriz de Prioridad

En la misma pantalla, para cada categoría puede configurar una **matriz de prioridad** que determina automáticamente la prioridad del ticket según la combinación de subcategoría + elemento de infraestructura.

Ejemplo:

| Subcategoría | Torre | Celda | Mástil | Punto de venta |
|---|---|---|---|---|
| Sin servicio | Urgente | Urgente | Alta | Alta |
| Internet lento | Media | Media | Baja | Baja |
| Configuración | Baja | Baja | Baja | Baja |

Use el editor de matriz (grilla) para asignar la prioridad a cada celda. La prioridad se aplica automáticamente al crear un ticket.

## 3.5 Gestión de Puntos de Venta

Desde **Administración > Puntos de venta**:

- CRUD completo de puntos de venta (locales comerciales).
- Asociados a una empresa.
- También se pueden sincronizar desde Supabase:

  ```bash
  docker compose exec backend python -m scripts.sync_sedes_supabase
  ```

## 3.6 Bandeja de Entrada (Mesa de Ayuda / Admin)

Desde **Bandeja de entrada** en la barra lateral:

- Ve todos los tickets abiertos y sin asignar.
- Puede **asignar** tickets a agentes específicos mediante el selector desplegable.
- Un agente también puede **auto-asignarse** tickets.
- Filtros por estado para organizar la cola.

### Flujo de asignación recomendado

1. Mesa de ayuda/admin revisa tickets nuevos en la bandeja.
2. Asigna al agente correspondiente según especialidad o carga de trabajo.
3. El agente recibe notificación en tiempo real y push (si no está conectado).

## 3.7 Gestión de Tickets (Admin)

Como administrador puede:

- **Ver todos los tickets** de todas las empresas.
- **Reasignar** tickets a otro agente o empresa.
- **Cambiar prioridad** manualmente.
- **Ver historial completo** de estados y comentarios.
- **Exportar tickets** a CSV desde el dashboard o desde reportes.

### Panel de detalle del ticket

- **Asignación**: Use el botón de asignar/auto-asignar.
- **Cambio de estado**: Use el selector de estados (solo transiciones válidas según la máquina de estados).
- **Reabrir**: Si un ticket está cerrado, puede reabrirlo (crea un nuevo ticket en estado `abierto` vinculado al original).
- **Comentarios**: Puede agregar comentarios públicos (visibles al cliente) o **notas internas** (visibles solo a agentes/admins).
- **Respuestas rápidas**: Use plantillas predefinidas para acelerar la respuesta.
- **Adjuntos**: Suba imágenes, vea la galería con lightbox. Solo imágenes (JPEG, PNG, WebP).

## 3.8 Respuestas Rápidas

Desde el panel de administración o desde el detalle del ticket:

- **Crear**: Defina una plantilla con título y contenido.
- **Usar**: En el detalle del ticket, haga clic en **Respuestas rápidas** y seleccione una para insertar el texto en el campo de comentario.
- **Editar/Eliminar**: Desde la sección de administración.

## 3.9 Tareas Pendientes

Desde **Tareas** en la barra lateral:

- Cree tareas asociadas o no a un ticket.
- Filtre por pendientes/completadas/todas.
- Deslice para marcar como completada o eliminar (en dispositivos táctiles).
- Arrastre para reordenar (en escritorio con puntero).

## 3.10 Métricas y Reportes

Desde **Métricas** en la barra lateral (visible para mesa_ayuda y admin):

### Tiempos

- Tiempo promedio y máximo de resolución.
- Tiempo promedio de primera respuesta.

### Volumen

- Tickets por empresa en un rango de fechas.
- Tendencia diaria/semanal/mensual.

### Infraestructura

- Desglose de tickets por elemento afectado (torre, celda, mástil, punto de venta).

### Rendimiento de Agentes

- Tickets resueltos por agente.
- Tiempo medio de resolución (MTTR) por agente.

### SLA

- Porcentaje de tickets resueltos dentro del SLA.

### Reporte CSV

- Exportación completa de tickets con todo el historial de estados.
- Accesible también desde el dashboard mediante filtros y botón de exportación.

## 3.11 Configuración del Sistema

### Modificar tiempo de sesión

Editar `backend/app/core/config.py` (líneas 22-23) o usar variables de entorno:

```
ACCESS_TOKEN_EXPIRE_MINUTES=120
REFRESH_TOKEN_EXPIRE_DAYS=30
```

Luego reconstruir:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build backend
```

### Configurar email transaccional

En `.env` del backend:

```
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_EMAIL="HelpDesk <soporte@tudominio.com>"
RESEND_URGENT_RECIPIENTS="admin@empresa.com,jefe@empresa.com"
```

### Configurar Web Push (VAPID)

```bash
# Generar claves VAPID
docker compose exec backend python -c "
from cryptography.hazmat.primitives.asymmetric.ec import generate_private_key, SECP256R1
from cryptography.hazmat.primitives import serialization
from base64 import urlsafe_b64encode
key = generate_private_key(SECP256R1())
pub = key.public_key()
pub_raw = pub.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
priv_raw = key.private_bytes(serialization.Encoding.Raw, serialization.PrivateFormat.Raw, serialization.NoEncryption())
print('VAPID_PUBLIC_KEY=' + urlsafe_b64encode(pub_raw).rstrip('=').decode())
print('VAPID_PRIVATE_KEY=' + urlsafe_b64encode(priv_raw).rstrip('=').decode())
"
```

Agregar al `.env` y reconstruir.

### Configurar cierre automático

```
TICKET_AUTO_CLOSE_DAYS=7
SCHEDULER_CLOSE_TICKETS_CRON="0 2 * * *"
```

### Sincronizar sedes desde Supabase

```bash
# Preview
docker compose exec backend python -m scripts.sync_sedes_supabase --dry-run

# Sincronizar
docker compose exec backend python -m scripts.sync_sedes_supabase
```

### Respaldo manual

```bash
# Backup completo
./scripts/backup.sh

# Restaurar
./scripts/backup.sh --restore 20260726_030000
```

## 3.12 Mantenimiento del Servidor

### Systemd (auto-restart en boot)

```bash
sudo cp deploy/helpdesk.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable helpdesk.service
sudo systemctl start helpdesk.service
sudo systemctl status helpdesk.service
```

### Migraciones de base de datos

```bash
# Autogenerar migración tras cambiar modelos
docker compose exec backend poetry run alembic revision --autogenerate -m "descripcion"

# Aplicar migraciones
docker compose exec backend poetry run alembic upgrade head
```

### Seed inicial

```bash
# Crea empresa demo (id=1) + admin inicial
docker compose exec backend python -m scripts.seed
```

### Ver logs

```bash
docker compose logs -f backend frontend scheduler
```

## 3.13 Resolución de Problemas Comunes

| Problema | Causa posible | Solución |
|---|---|---|
| Error 401 al cargar imágenes | Token expirado | El frontend refresca automáticamente; cerrar sesión y volver a ingresar |
| WebSocket desconectado | Redirección Cloudflare | Keepalive cada 60s; si persiste, verificar conectividad |
| Push notifications no llegan | Permiso denegado en navegador | El usuario debe permitir notificaciones desde la configuración del navegador |
| Email no se envía | API key de Resend inválida o vacía | Verificar `RESEND_API_KEY` en `.env` |
| Backup falla | Disco lleno (>90%) | Liberar espacio o cambiar `BACKUP_ROOT` |
| Ticket no cambia de estado | Transición inválida | Solo se permite: abierto→asignado→en_progreso→resuelto→cerrado |
| Caddy certificado no confiable | CA auto-firmada no instalada | Descargar `http://helpdesk.local/ca.crt` e instalar como CA raíz de confianza |

## 3.14 Cloudflare Tunnel (acceso desde internet)

Si se configuró Cloudflare Tunnel:

1. El tráfico externo llega a `https://soporte.tudominio.com`.
2. Cloudflare Zero Trust puede requerir autenticación One-Time PIN por email.
3. El túnel es outbound-only (no requiere abrir puertos en el router).
4. El WebSocket envía keepalive cada 60s para evitar el idle timeout de Cloudflare (100s).

### Requisitos

- `CLOUDFLARE_TUNNEL_TOKEN` configurado en `.env`.
- El túnel debe estar creado en el dashboard de Cloudflare Zero Trust.
- El ingress debe apuntar a `caddy:80`.

## 3.15 Seguridad

- **JWT**: Tokens firmados con HS256. El access token expira en 30 minutos (configurable); el refresh token en 7 días.
- **Contraseñas**: Hasheadas con bcrypt.
- **Aislamiento multi-tenant**: Los clientes solo ven tickets de su propia empresa. Los agentes solo ven los tickets asignados a ellos.
- **Adjuntos**: Solo imágenes permitidas, validación de magic bytes, acceso exclusivo vía backend autenticado (sin URL pública de MinIO).
- **CORS**: Restringido a orígenes configurados.
- **Cookies**: `COOKIE_SECURE=true` en producción.
- **Cloudflare**: Zero Trust Access con One-Time PIN (opcional).

---

*Documentación generada para HelpDesk GMP v1.0*
