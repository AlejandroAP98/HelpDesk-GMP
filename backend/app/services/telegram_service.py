"""Servicio de notificaciones via Telegram Bot API (https://core.telegram.org/bots/api).

Envia mensajes a un grupo compartido donde estan los usuarios de mesa_ayuda y
administrador. Si `telegram_bot_token` o `telegram_chat_id` estan vacios, el
servicio se desactiva (no hace nada y loguea).

Eventos que disparan mensaje (via pubsub._dispatch_push):
    - ticket:urgent_created (con marca URGENTE)
    - ticket:new (se omite si ya es urgente: el mensaje urgente lo cubre)
    - ticket:commented
    - ticket:state_changed
    - ticket:assigned
    - actividad:nueva (asignacion, cambio de estado, reaperturas, etc.)

Throttle: maximo 1 mensaje por (tipo_evento, ticket_id) cada 60s via Redis,
para que un ticket muy activo no inunde el grupo.
"""

from __future__ import annotations

import asyncio
import html
import logging
from typing import Any

import httpx

from app.core.config import settings
from app.core.redis import redis_client

logger = logging.getLogger(__name__)

TELEGRAM_API_URL_TEMPLATE = "https://api.telegram.org/bot{token}/sendMessage"
TIMEOUT = 10.0
_MAX_RETRIES = 2
_RETRY_DELAYS = [2.0, 4.0]

THROTTLE_PREFIX = "helpdesk:telegram:throttle:"
THROTTLE_SEGUNDOS = 60

_EVENTOS_NOTIFICADOS = {
    "ticket:urgent_created",
    "ticket:new",
    # "ticket:commented",
    # "ticket:state_changed",
    # "ticket:assigned",
    # "actividad:nueva",
}

_EMOJIS_ACTIVIDAD = {
    "ticket_created": "\U0001f195",
    "ticket_assigned": "\U0001f4cc",
    "state_changed": "\U0001f504",
    "priority_changed": "\u26a0\ufe0f",
    "ticket_reopened": "\U0001f501",
    "comment_added": "\U0001f4ac",
    "attachment_uploaded": "\U0001f4ce",
}

_background_tasks: set["asyncio.Task[bool]"] = set()


def is_telegram_enabled() -> bool:
    return bool(settings.telegram_bot_token and settings.telegram_chat_id)


async def _send(texto: str) -> bool:
    if not is_telegram_enabled():
        logger.debug("Telegram omitido (TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID vacio)")
        return False
    url = TELEGRAM_API_URL_TEMPLATE.format(token=settings.telegram_bot_token)
    payload = {
        "chat_id": settings.telegram_chat_id,
        "text": texto,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    last_exception: Exception | None = None
    for attempt in range(_MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                r = await client.post(url, json=payload)
            if r.status_code >= 400:
                logger.warning(
                    "Telegram rechazo mensaje status=%d body=%s", r.status_code, r.text[:300]
                )
                return False
            return True
        except (httpx.ConnectError, httpx.TimeoutException) as exc:
            last_exception = exc
            if attempt < _MAX_RETRIES:
                delay = _RETRY_DELAYS[attempt]
                logger.warning(
                    "Intento %d/%d fallido para Telegram: %s. Reintentando en %.1fs",
                    attempt + 1,
                    _MAX_RETRIES + 1,
                    type(exc).__name__,
                    delay,
                )
                await asyncio.sleep(delay)
        except Exception:
            logger.exception("Error inesperado enviando mensaje de Telegram")
            return False
    if last_exception:
        logger.error(
            "Fallo definitivo envio Telegram tras %d intentos: %s",
            _MAX_RETRIES + 1,
            last_exception,
        )
    return False


def _ticket_url(ticket_id: str) -> str:
    return f"https://soporte.gmpredes.online/tickets/{ticket_id}"


def _link(ticket_id: str) -> str:
    return f'<a href="{_ticket_url(ticket_id)}">#{str(ticket_id).split("-")[0][:8].upper()}</a>'


def _esc(value: Any) -> str:
    return html.escape(str(value or ""), quote=False)


def _trunc(value: str | None, n: int) -> str:
    texto = (value or "").strip()
    return texto if len(texto) <= n else texto[: n - 1] + "\u2026"


def _skip_evento(event: dict[str, Any]) -> str | None:
    """Retorna texto a enviar, o None si el evento no debe notificarse.

    ticket:new con prioridad urgente se omite: el mensaje de
    ticket:urgent_created que llega en el mismo flujo ya lo cubre.
    """
    etype = event.get("type")
    if etype not in _EVENTOS_NOTIFICADOS:
        return None
    if etype == "ticket:new" and event.get("prioridad", "").lower() == "urgente":
        return None
    return etype  # type: ignore[return-value]


async def _throttle(key: str) -> bool:
    try:
        acquired = await redis_client.set(
            f"{THROTTLE_PREFIX}{key}", "1", nx=True, ex=THROTTLE_SEGUNDOS
        )
        return not acquired
    except Exception:
        logger.debug("Throttle Telegram no disponible (fallando abierto)", exc_info=True)
        return False


def _render(event: dict[str, Any], etype: str) -> str:
    if etype == "ticket:urgent_created":
        empresa = _esc(event.get("empresa_nombre") or "?")
        tid = str(event.get("ticket_id", ""))
        return (
            f"\U0001f534 <b>[URGENTE]</b> Nuevo ticket en {empresa}\n"
            f"{_esc(event.get('titulo'))} {_link(tid)}\n"
            f"Prioridad: {_esc(event.get('prioridad'))} \u2014 Estado: {_esc(event.get('estado'))}"
        )
    if etype == "ticket:new":
        empresa = _esc(event.get("empresa_nombre") or "?")
        punto = _esc(event.get("nombre_punto") or "")
        tid = str(event.get("ticket_id", ""))
        linea_punto = f" \u2014 {punto}" if punto else ""
        return (
            f"\U0001f195 Nuevo ticket en {empresa}{linea_punto}\n"
            f"{_esc(event.get('titulo'))} {_link(tid)}\n"
            f"Prioridad: {_esc(event.get('prioridad'))} \u2014 Estado: {_esc(event.get('estado'))}"
        )
    if etype == "ticket:commented":
        tid = str(event.get("ticket_id", ""))
        nota = " (nota interna)" if event.get("es_nota_interna") else ""
        contenido = _esc(_trunc(event.get("contenido"), 200))
        cuerpo = (
            f"\U0001f4ac <b>{_esc(event.get('usuario_nombre'))}</b> comentó{nota} en {_link(tid)}"
        )
        return f"{cuerpo}\n{contenido}" if contenido else cuerpo
    if etype == "ticket:state_changed":
        tid = str(event.get("ticket_id", ""))
        return (
            f"\U0001f504 {_link(tid)} {_esc(event.get('titulo'))}\n"
            f"{_esc(event.get('estado_anterior'))} \u2192 "
            f"<b>{_esc(event.get('estado_nuevo'))}</b>"
        )
    if etype == "ticket:assigned":
        tid = str(event.get("ticket_id", ""))
        return (
            f"\U0001f4cc Ticket asignado: {_esc(event.get('titulo'))} {_link(tid)}\n"
            f"Estado: {_esc(event.get('estado'))} \u2014 Prioridad: {_esc(event.get('prioridad'))}"
        )
    if etype == "actividad:nueva":
        act = event.get("actividad", {})
        tipo = str(act.get("tipo_evento", ""))
        emoji = _EMOJIS_ACTIVIDAD.get(tipo, "\U0001f4dd")
        usuario_remitente = _esc(act.get("usuario_nombre"))
        tid = str(act.get("ticket_id") or "")
        extra = (
            f" {_esc(act.get('metadata', {}).get('detalle', ''))}" if act.get("metadata") else ""
        )
        if tipo == "priority_changed":
            meta = act.get("metadata", {})
            extra = (
                f" {_esc(meta.get('prioridad_anterior'))} \u2192 {_esc(meta.get('prioridad_nueva'))}"
                if meta
                else ""
            )
        cuerpo = f"{emoji} <b>{usuario_remitente}</b> {extra}".strip()
        return f"{cuerpo}\n{_link(tid)}" if tid else cuerpo
    return f"\U0001f4dd Evento {etype}"


async def notify_event(event: dict[str, Any]) -> bool:
    """Compone y envia el mensaje del evento al grupo de Telegram.

    Fire-and-forget desde el dispatcher (create_task en pubsub): devuelve bool
    para tests. Respeta throttle de 60s por (tipo, ticket_id).
    """
    etype = _skip_evento(event)
    if etype is None:
        return False
    tid = str(event.get("ticket_id") or (event.get("actividad") or {}).get("ticket_id") or "")
    if tid and await _throttle(f"{etype}:{tid}"):
        logger.debug("Telegram omitido por throttle: %s ticket=%s", etype, tid)
        return False
    texto = _render(event, etype)
    return await _send(texto)


def spawn_notify_event(event: dict[str, Any]) -> None:
    """Lanza notify_event en background manteniendo referencia al Task.

    Se usa desde el bucle pubsub: los eventos multiples vienen
    rapidisimos y el mejoramiento embarroso (bloqueo del listener por
    hasta 10s de timeout) es indeseable para los WS del resto de eventos.
    """
    try:
        task = asyncio.create_task(notify_event(event))
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)
    except RuntimeError:
        logger.warning("No se pudo lanzar notificacion Telegram (loop cerrado)", exc_info=True)
