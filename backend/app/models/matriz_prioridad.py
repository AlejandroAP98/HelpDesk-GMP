"""Modelo MatrizPrioridad: mapping configurable de prioridad por categoria+subcategoria+elemento."""
from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class MatrizPrioridad(Base):
    __tablename__ = "matriz_prioridad"
    __table_args__ = (
        UniqueConstraint(
            "categoria_id",
            "subcategoria_id",
            "elemento",
            name="uq_matriz_prioridad_combo",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    categoria_id: Mapped[int] = mapped_column(
        ForeignKey("categorias.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subcategoria_id: Mapped[int] = mapped_column(
        ForeignKey("subcategorias.id", ondelete="CASCADE"), nullable=False, index=True
    )
    elemento: Mapped[str] = mapped_column(String(20), nullable=False)
    prioridad: Mapped[str] = mapped_column(String(20), nullable=False)

    def __repr__(self) -> str:
        return (
            f"<MatrizPrioridad id={self.id} cat={self.categoria_id} "
            f"sub={self.subcategoria_id} elem={self.elemento!r} pri={self.prioridad!r}>"
        )
