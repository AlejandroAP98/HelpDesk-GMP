"""Modelo PuntoVenta: sedes/sucursales de cada empresa (sincronizadas desde GMP)."""
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.empresa import Empresa


class PuntoVenta(Base):
    __tablename__ = "puntos_venta"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    empresa_id: Mapped[int] = mapped_column(
        ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False
    )
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    direccion: Mapped[str | None] = mapped_column(Text, nullable=True)
    ciudad: Mapped[str | None] = mapped_column(String(100), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        Index("idx_puntos_venta_empresa", "empresa_id"),
    )

    def __repr__(self) -> str:
        return f"<PuntoVenta id={self.id} nombre={self.nombre!r} empresa_id={self.empresa_id}>"
