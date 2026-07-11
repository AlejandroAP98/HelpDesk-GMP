"""Modelo Subcategoria: subclasificacion dentro de una Categoria."""
from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Subcategoria(Base):
    __tablename__ = "subcategorias"
    __table_args__ = (
        UniqueConstraint("categoria_id", "nombre", name="uq_subcategoria_categoria_nombre"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    categoria_id: Mapped[int] = mapped_column(
        ForeignKey("categorias.id", ondelete="CASCADE"), nullable=False
    )
    nombre: Mapped[str] = mapped_column(String(80), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<Subcategoria id={self.id} nombre={self.nombre!r} categoria_id={self.categoria_id}>"
