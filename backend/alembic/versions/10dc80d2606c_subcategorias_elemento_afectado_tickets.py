"""subcategorias_elemento_afectado_tickets

Revision ID: 10dc80d2606c
Revises: b2c3d4e5f6a7
Create Date: 2026-07-10 23:00:07.247509
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '10dc80d2606c'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CATEGORIAS = [
    ("Soporte", [
        ("Caída total del servicio", "Interrupción completa del servicio de conectividad"),
        ("Lentitud o intermitencia", "Degradación o intermitencia en la conexión"),
    ]),
    ("Instalación", [
        ("Instalación o Cambio de Hardware", "Montaje, reemplazo o migración de equipos de red"),
        ("Cableado estructurado", "Despliegue de red LAN, canalización o peinado de rack"),
        ("Configuración de equipos nuevos", "Comisionamiento y aprovisionamiento de routers/switches"),
    ]),
    ("Mantenimiento", [
        ("Actualización de Software", "Parcheo de firmware o sistema operativo en equipos de red"),
        ("Limpieza y Respaldo", "Mantenimiento preventivo físico y lógico de infraestructura"),
    ]),
]


def upgrade() -> None:
    # 1. Crear tipo ENUM
    elemento_enum = sa.Enum(
        'torre', 'celda', 'mastil', 'punto_venta',
        name='elemento_infraestructura',
    )
    elemento_enum.create(op.get_bind(), checkfirst=True)

    # 2. Crear tabla subcategorias
    op.create_table('subcategorias',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('categoria_id', sa.Integer(), nullable=False),
        sa.Column('nombre', sa.String(length=80), nullable=False),
        sa.Column('descripcion', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['categoria_id'], ['categorias.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('categoria_id', 'nombre', name='uq_subcategoria_categoria_nombre')
    )

    # 3. Insertar categorías reales de la matriz y subcategorías
    conn = op.get_bind()
    for cat_nombre, subcats in CATEGORIAS:
        result = conn.execute(
            sa.text("SELECT id FROM categorias WHERE nombre = :n"), {"n": cat_nombre}
        ).fetchone()
        if result is None:
            conn.execute(
                sa.text("INSERT INTO categorias (nombre) VALUES (:n) RETURNING id"),
                {"n": cat_nombre},
            )
            cat_id = conn.execute(
                sa.text("SELECT id FROM categorias WHERE nombre = :n"), {"n": cat_nombre}
            ).fetchone()[0]
        else:
            cat_id = result[0]
        for sub_nombre, sub_desc in subcats:
            exists = conn.execute(
                sa.text("SELECT id FROM subcategorias WHERE categoria_id = :cid AND nombre = :n"),
                {"cid": cat_id, "n": sub_nombre},
            ).fetchone()
            if exists is None:
                conn.execute(
                    sa.text("INSERT INTO subcategorias (categoria_id, nombre, descripcion) VALUES (:cid, :n, :d)"),
                    {"cid": cat_id, "n": sub_nombre, "d": sub_desc},
                )

    # 4. Agregar columnas nullable temporalmente
    op.add_column('tickets', sa.Column('subcategoria_id', sa.Integer(), nullable=True))
    op.add_column('tickets', sa.Column(
        'elemento_afectado',
        sa.Enum('torre', 'celda', 'mastil', 'punto_venta', name='elemento_infraestructura'),
        nullable=True,
    ))

    # 5. Asignar subcategoria por defecto (primera de la categoría "Soporte") y elemento "punto_venta"
    conn.execute(sa.text(
        "UPDATE tickets SET subcategoria_id = ("
        "  SELECT s.id FROM subcategorias s "
        "  JOIN categorias c ON s.categoria_id = c.id "
        "  WHERE c.nombre = 'Soporte' ORDER BY s.id LIMIT 1"
        "), elemento_afectado = 'punto_venta'"
    ))

    # 6. Ahora sí, NOT NULL
    op.alter_column('tickets', 'subcategoria_id', nullable=False)
    op.alter_column('tickets', 'elemento_afectado', nullable=False)

    # 7. FK
    op.create_foreign_key(None, 'tickets', 'subcategorias', ['subcategoria_id'], ['id'], ondelete='RESTRICT')


def downgrade() -> None:
    op.drop_constraint(None, 'tickets', type_='foreignkey')
    op.drop_column('tickets', 'elemento_afectado')
    op.drop_column('tickets', 'subcategoria_id')
    op.execute(sa.text("DELETE FROM subcategorias"))
    op.drop_table('subcategorias')
    sa.Enum(name='elemento_infraestructura').drop(op.get_bind(), checkfirst=True)
