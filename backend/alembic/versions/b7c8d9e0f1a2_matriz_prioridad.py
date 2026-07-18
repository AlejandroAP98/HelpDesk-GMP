"""tabla matriz_prioridad

Revision ID: b7c8d9e0f1a2
Revises: f1a2b3c4d5e6
Create Date: 2026-07-18 10:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "b7c8d9e0f1a2"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "matriz_prioridad",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("categoria_id", sa.Integer(), nullable=False),
        sa.Column("subcategoria_id", sa.Integer(), nullable=False),
        sa.Column("elemento", sa.String(length=20), nullable=False),
        sa.Column("prioridad", sa.String(length=20), nullable=False),
        sa.ForeignKeyConstraint(
            ["categoria_id"], ["categorias.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["subcategoria_id"], ["subcategorias.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "categoria_id",
            "subcategoria_id",
            "elemento",
            name="uq_matriz_prioridad_combo",
        ),
    )
    op.create_index(
        "ix_matriz_prioridad_categoria",
        "matriz_prioridad",
        ["categoria_id"],
        unique=False,
    )
    op.create_index(
        "ix_matriz_prioridad_subcategoria",
        "matriz_prioridad",
        ["subcategoria_id"],
        unique=False,
    )

    op.execute("""
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN
                SELECT c.id AS cat_id, s.id AS sub_id, m.elem, m.pri
                FROM categorias c
                JOIN subcategorias s ON s.categoria_id = c.id
                CROSS JOIN (VALUES
                    ('Soporte', 'Caída total del servicio', 'torre', 'urgente'),
                    ('Soporte', 'Caída total del servicio', 'celda', 'urgente'),
                    ('Soporte', 'Caída total del servicio', 'mastil', 'alta'),
                    ('Soporte', 'Caída total del servicio', 'punto_venta', 'alta'),
                    ('Soporte', 'Lentitud o intermitencia', 'torre', 'alta'),
                    ('Soporte', 'Lentitud o intermitencia', 'celda', 'alta'),
                    ('Soporte', 'Lentitud o intermitencia', 'mastil', 'media'),
                    ('Soporte', 'Lentitud o intermitencia', 'punto_venta', 'media'),
                    ('Instalación', 'Instalación o Cambio de Hardware', 'torre', 'media'),
                    ('Instalación', 'Instalación o Cambio de Hardware', 'mastil', 'media'),
                    ('Instalación', 'Instalación o Cambio de Hardware', 'punto_venta', 'baja'),
                    ('Instalación', 'Cableado estructurado', 'punto_venta', 'baja'),
                    ('Instalación', 'Configuración de equipos nuevos', 'torre', 'media'),
                    ('Instalación', 'Configuración de equipos nuevos', 'mastil', 'media'),
                    ('Instalación', 'Configuración de equipos nuevos', 'punto_venta', 'baja'),
                    ('Mantenimiento', 'Actualización de Software', 'torre', 'media'),
                    ('Mantenimiento', 'Actualización de Software', 'celda', 'media'),
                    ('Mantenimiento', 'Actualización de Software', 'mastil', 'baja'),
                    ('Mantenimiento', 'Actualización de Software', 'punto_venta', 'baja'),
                    ('Mantenimiento', 'Limpieza y Respaldo', 'torre', 'baja'),
                    ('Mantenimiento', 'Limpieza y Respaldo', 'celda', 'baja'),
                    ('Mantenimiento', 'Limpieza y Respaldo', 'mastil', 'baja'),
                    ('Mantenimiento', 'Limpieza y Respaldo', 'punto_venta', 'baja')
                ) AS m(cat_nombre, sub_nombre, elem, pri)
                WHERE c.nombre = m.cat_nombre AND s.nombre = m.sub_nombre
            LOOP
                INSERT INTO matriz_prioridad (categoria_id, subcategoria_id, elemento, prioridad)
                VALUES (r.cat_id, r.sub_id, r.elem, r.pri)
                ON CONFLICT DO NOTHING;
            END LOOP;
        END $$;
    """)


def downgrade() -> None:
    op.drop_index("ix_matriz_prioridad_subcategoria", table_name="matriz_prioridad")
    op.drop_index("ix_matriz_prioridad_categoria", table_name="matriz_prioridad")
    op.drop_table("matriz_prioridad")
