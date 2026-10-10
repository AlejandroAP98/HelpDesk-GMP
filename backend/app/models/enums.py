"""Enumeraciones del dominio HelpDesk-GMP.

Replican los tipos ENUM definidos en `agent.md` §2 (PostgreSQL).
Se reutilizan tanto en columnas SQLAlchemy como en validaciones Pydantic.
"""
from enum import Enum


class RolUsuario(str, Enum):
    cliente = "cliente"
    agente = "agente"
    mesa_ayuda = "mesa_ayuda"
    administrador = "administrador"


class EstadoTicket(str, Enum):
    abierto = "abierto"
    asignado = "asignado"
    en_progreso = "en_progreso"
    resuelto = "resuelto"
    cerrado = "cerrado"


class PrioridadTicket(str, Enum):
    baja = "baja"
    media = "media"
    alta = "alta"
    urgente = "urgente"


class ElementoInfraestructura(str, Enum):
    torre = "torre"
    celda = "celda"
    punto_venta = "punto_venta"


class VistaTicket(str, Enum):
    activos = "activos"
    todos = "todos"