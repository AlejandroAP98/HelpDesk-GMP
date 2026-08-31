"""Modelos ORM del HelpDesk-GMP.

Importar todos los modelos aqui asegura que Alembic los detecte al autogenerar
migraciones (ver `alembic/env.py` :: `import app.models`).
"""
from app.models.enums import EstadoTicket, PrioridadTicket, RolUsuario, ElementoInfraestructura
from app.models.empresa import Empresa
from app.models.usuario import Usuario
from app.models.categoria import Categoria
from app.models.subcategoria import Subcategoria
from app.models.ticket import Ticket
from app.models.comentario import Comentario
from app.models.adjunto import Adjunto
from app.models.historial_estado import HistorialEstado
from app.models.push_subscription import PushSubscription
from app.models.tarea_pendiente import TareaPendiente
from app.models.matriz_prioridad import MatrizPrioridad
from app.models.respuesta_rapida import RespuestaRapida
from app.models.punto_venta import PuntoVenta
from app.models.evento_calendario import EventoCalendario

__all__ = [
    "EstadoTicket",
    "PrioridadTicket",
    "RolUsuario",
    "ElementoInfraestructura",
    "Empresa",
    "Usuario",
    "Categoria",
    "Subcategoria",
    "Ticket",
    "Comentario",
    "Adjunto",
    "HistorialEstado",
    "PushSubscription",
    "TareaPendiente",
    "MatrizPrioridad",
    "RespuestaRapida",
    "PuntoVenta",
    "EventoCalendario",
]