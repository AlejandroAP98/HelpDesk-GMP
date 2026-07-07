"""Modelos ORM del HelpDesk-GMP.

Importar todos los modelos aqui asegura que Alembic los detecte al autogenerar
migraciones (ver `alembic/env.py` :: `import app.models`).
"""
from app.models.enums import EstadoTicket, PrioridadTicket, RolUsuario
from app.models.empresa import Empresa
from app.models.usuario import Usuario
from app.models.categoria import Categoria
from app.models.ticket import Ticket
from app.models.comentario import Comentario
from app.models.adjunto import Adjunto

__all__ = [
    "EstadoTicket",
    "PrioridadTicket",
    "RolUsuario",
    "Empresa",
    "Usuario",
    "Categoria",
    "Ticket",
    "Comentario",
    "Adjunto",
]