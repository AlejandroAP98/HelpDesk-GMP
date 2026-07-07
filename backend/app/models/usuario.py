"""Modelo Usuario: clientes y equipo interno (agentes/admins)."""
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.enums import RolUsuario

if TYPE_CHECKING:
    from app.models.empresa import Empresa


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[UUID] = mapped_column(
        server_default=func.gen_random_uuid(), primary_key=True
    )
    empresa_id: Mapped[int | None] = mapped_column(
        ForeignKey("empresas.id", ondelete="SET NULL"), nullable=True
    )
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    rol: Mapped[RolUsuario] = mapped_column(
        SAEnum(RolUsuario, name="rol_usuario", create_type=True, validate_strings=True),
        nullable=False,
    )
    fecha_creacion: Mapped[datetime] = mapped_column(
        server_default=func.current_timestamp(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<Usuario id={self.id} email={self.email!r} rol={self.rol}>"