"""Servicio de emails transaccionales via Resend (https://resend.com).

Usa la API HTTP de Resend directamente con httpx (async-native, sin SDK sync).
Si `resend_api_key` esta vacio, el servicio se desactiva (no hace nada y loguea).

Eventos que disparan email:
    - Ticket creado: confirmacion al cliente (su correo).
    - Ticket resuelto: notificacion al cliente.
    - Ticket urgente creado: alerta a la lista `resend_urgent_recipients`.
"""
from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

import httpx

from app.core.config import settings
from app.models.ticket import Ticket

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"
_TIMEOUT = 10.0


def _urgent_recipients() -> list[str]:
    return [e.strip() for e in settings.resend_urgent_recipients.split(",") if e.strip()]


def is_email_enabled() -> bool:
    return bool(settings.resend_api_key)


async def _send(to: list[str], subject: str, html: str, text: str | None = None) -> bool:
    if not is_email_enabled():
        logger.debug("Email omitido (RESEND_API_KEY vacio): to=%s subject=%s", to, subject)
        return False
    payload: dict[str, Any] = {
        "from": settings.resend_from_email,
        "to": to,
        "subject": subject,
        "html": html,
    }
    if text:
        payload["text"] = text
    headers = {
        "Authorization": f"Bearer {settings.resend_api_key}",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.post(RESEND_API_URL, json=payload, headers=headers)
        if r.status_code >= 400:
            logger.warning(
                "Resend rechazo email a=%s subject=%s status=%d body=%s",
                to,
                subject,
                r.status_code,
                r.text[:300],
            )
            return False
        logger.info("Email enviado via Resend a=%s subject=%s", to, subject)
        return True
    except Exception:
        logger.exception("Fallo envio email a=%s subject=%s", to, subject)
        return False


def _ticket_url(ticket_id: UUID) -> str:
    return f"https://soporte.gmpredes.online/tickets/{ticket_id}"


def _render_ticket_created(ticket: Ticket, cliente_email: str) -> tuple[str, str]:
    subject = f"[Soporte GMP] Ticket #{str(ticket.id)[:8].upper()} recibido: {ticket.titulo}"
    html = f"""
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 28px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 8px;">
            <img src="https://soporte.gmpredes.online/icon-192.png" alt="GMP Redes" height="40" style="height: 40px; width: auto; max-height: 40px; display: block; border: 0; outline: none; text-decoration: none;" onerror="this.onerror=null; this.src='https://placehold.co/120x32/2563eb/ffffff?text=GMP+Redes';">
        </div>
        <h2 style="color: #007991; margin-top: 0; font-size: 24px; font-weight: 700; margin-bottom: 16px;">Tu ticket fue recibido</h2>
        <p style="color: #374151; font-size: 14px; line-height: 1.5; margin-bottom: 12px;">Hola, {cliente_email}</p>
        <p style="color: #374151; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">Registramos tu solicitud de soporte. Ingresa al sistema para dar seguimiento al mismo o hablar con el técnico asignado.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
            <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">ID: </td>
            <td style="padding: 10px 0; text-align: right;"><code style="background-color: #f3f4f6; padding: 3px 8px; border-radius: 4px; font-family: monospace; color: #1f2937; text-transform: uppercase;">#{str(ticket.id).split("-")[0]}</code></td>
            </tr>
            <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Título: </td>
            <td style="padding: 10px 0; text-align: right;"><strong style="color: #111827; text-transform: capitalize;">{ticket.titulo}</strong></td>
            </tr>
            <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Prioridad: </td>
            <td style="padding: 10px 0; text-align: right;"><span style="color: #1f2937; text-transform: capitalize;">{ticket.prioridad.value}</span></td>
            </tr>
            <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Estado: </td>
            <td style="padding: 10px 0; text-align: right;"><span style="color: #1f2937; text-transform: capitalize;">{ticket.estado.value}</span></td>
            </tr>
        </table>

        <p style="margin-top: 28px; text-align: center;">
            <a href="{_ticket_url(ticket.id)}" style="background-color: #508484; color: #ffffff; padding: 11px 22px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block; font-size: 14px;">Ver ticket</a>
        </p>
        </div>
    """.strip()
    return subject, html


def _render_ticket_resolved(ticket: Ticket, cliente_email: str) -> tuple[str, str]:
    subject = f"[Soporte GMP] Ticket #{str(ticket.id)[:8].upper()} resuelto: {ticket.titulo}"
    html = f"""
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 28px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
         <div style="margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 2px;">
            <img src="https://soporte.gmpredes.online/icon-192.png" alt="GMP Redes" height="40" style="height: 40px; width: auto; max-height: 40px; display: block; border: 0; outline: none; text-decoration: none;" onerror="this.onerror=null; this.src='https://placehold.co/120x32/2563eb/ffffff?text=GMP+Redes';">
        </div>
        <h2 style="color: #60993e; margin-top: 0; font-size: 24px; font-weight: 700; margin-bottom: 16px;">Tu ticket ha sido resuelto</h2>
        <p style="color: #374151; font-size: 14px; line-height: 1.5; margin-bottom: 12px;">Hola, {cliente_email}</p>
        <p style="color: #374151; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">El equipo de soporte ha marcado tu ticket como resuelto. Si el problema persiste, puedes responder desde la plataforma y lo reabriremos. Si todo está bien, puedes cerrarlo para confirmar.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
            <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">ID: </td>
            <td style="padding: 10px 0; text-align: right;"><code style="background-color: #f3f4f6; padding: 3px 8px; border-radius: 4px; font-family: monospace; color: #1f2937; text-transform: uppercase;">#{str(ticket.id).split("-")[0]}</code></td>
            </tr>
            <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Título: </td>
            <td style="padding: 10px 0; text-align: right;"><strong style="color: #111827; text-transform: capitalize;">{ticket.titulo}</strong></td>
            </tr>
            <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Prioridad: </td>
            <td style="padding: 10px 0; text-align: right;"><span style="color: #1f2937; text-transform: capitalize;">{ticket.prioridad.value}</span></td>
            </tr>
            <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Estado: </td>
            <td style="padding: 10px 0; text-align: right;"><span style="color: #1f2937; text-transform: capitalize;">{ticket.estado.value}</span></td>
            </tr>
        </table>

        <p style="margin-top: 28px; text-align: center;">
            <a href="{_ticket_url(ticket.id)}" style="background-color: #508484; color: #ffffff; padding: 11px 22px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block; font-size: 14px;">Ver ticket</a>
        </p>
    </div>
    """.strip()
    return subject, html


def _render_ticket_urgent(
    ticket: Ticket, empresa_nombre: str | None
) -> tuple[str, str]:
    empresa = empresa_nombre or "?"
    subject = f"[URGENTE] Nuevo ticket en {empresa}: {ticket.titulo}"
    html = f"""
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; border-left: 4px solid #dc2626; padding-left: 16px;  background-color: #ffffff;">
      <h2 style="color: #dc2626;">Ticket urgente recibido</h2>
      <p style="color: #000;">Se creo un ticket con prioridad <strong>URGENTE</strong> en la empresa <strong>{empresa}</strong>.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 6px 0; color: #6b7280;">ID: </td><td><code style="color: #000; text-transform: uppercase;">#{str(ticket.id).split("-")[0]}</code></td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280;">Título: </td><td style="color: #000;"><strong>{ticket.titulo}</strong></td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280;">Descripción: </td><td style="color: #000;" >{ticket.descripcion[:300]}</td></tr>
      </table>
      <p style="margin-top: 24px;">
        <a href="{_ticket_url(ticket.id)}" style="background: #dc2626; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">Ver ticket</a>
      </p>
    </div>
    """.strip()
    return subject, html


async def send_ticket_created(ticket: Ticket, cliente_email: str) -> bool:
    if not cliente_email:
        return False
    subject, html = _render_ticket_created(ticket, cliente_email)
    return await _send([cliente_email], subject, html)


async def send_ticket_resolved(ticket: Ticket, cliente_email: str) -> bool:
    if not cliente_email:
        return False
    subject, html = _render_ticket_resolved(ticket, cliente_email)
    return await _send([cliente_email], subject, html)


async def send_ticket_urgent(ticket: Ticket, empresa_nombre: str | None) -> bool:
    recipients = _urgent_recipients()
    if not recipients:
        logger.debug("Email urgente omitido: RESEND_URGENT_RECIPIENTS vacio")
        return False
    subject, html = _render_ticket_urgent(ticket, empresa_nombre)
    return await _send(recipients, subject, html)
