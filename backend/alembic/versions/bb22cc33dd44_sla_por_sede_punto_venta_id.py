"""SLA por sede: tickets.punto_venta_id + limpieza de elemento mastil

Revision ID: bb22cc33dd44
Revises: aa11bb22cc33
Create Date: 2026-09-22
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'bb22cc33dd44'
down_revision: Union[str, None] = 'aa11bb22cc33'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'tickets',
        sa.Column('punto_venta_id', sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        'fk_tickets_punto_venta',
        'tickets',
        'puntos_venta',
        ['punto_venta_id'],
        ['id'],
        ondelete='SET NULL',
    )
    op.create_index('idx_tickets_punto_venta', 'tickets', ['punto_venta_id'])

    op.execute(
        "UPDATE tickets t SET punto_venta_id = pv.id"
        " FROM puntos_venta pv"
        " WHERE pv.empresa_id = t.empresa_id"
        " AND pv.nombre = t.nombre_punto"
        " AND t.punto_venta_id IS NULL"
        " AND t.elemento_afectado = 'punto_venta'"
    )

    op.execute(
        "UPDATE tickets SET elemento_afectado = 'torre'"
        " WHERE elemento_afectado = 'mastil'"
    )

    op.execute(
        "UPDATE matriz_prioridad mp SET elemento = 'torre'"
        " WHERE mp.elemento = 'mastil'"
        " AND NOT EXISTS ("
        "  SELECT 1 FROM matriz_prioridad mp2"
        "  WHERE mp2.categoria_id = mp.categoria_id"
        "  AND mp2.subcategoria_id = mp.subcategoria_id"
        "  AND mp2.elemento = 'torre'"
        ")"
    )
    op.execute(
        "DELETE FROM matriz_prioridad mp"
        " WHERE mp.elemento = 'mastil'"
    )


def downgrade() -> None:
    op.drop_index('idx_tickets_punto_venta', table_name='tickets')
    op.drop_constraint('fk_tickets_punto_venta', 'tickets', type_='foreignkey')
    op.drop_column('tickets', 'punto_venta_id')
