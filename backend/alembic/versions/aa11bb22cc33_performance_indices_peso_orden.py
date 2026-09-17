"""performance: indices de listado/tokens + columna peso_orden en tickets

Revision ID: aa11bb22cc33
Revises: 82b1f1602f00
Create Date: 2026-09-17
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'aa11bb22cc33'
down_revision: Union[str, None] = '82b1f1602f00'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PESO_ORDEN_SQL = (
    "CASE estado"
    " WHEN 'en_progreso'::estado_ticket THEN 1"
    " WHEN 'asignado'::estado_ticket THEN 2"
    " WHEN 'abierto'::estado_ticket THEN 3"
    " WHEN 'resuelto'::estado_ticket THEN 4"
    " WHEN 'cerrado'::estado_ticket THEN 5"
    " ELSE 6 END * 10 +"
    " CASE prioridad"
    " WHEN 'urgente'::prioridad_ticket THEN 1"
    " WHEN 'alta'::prioridad_ticket THEN 2"
    " WHEN 'media'::prioridad_ticket THEN 3"
    " WHEN 'baja'::prioridad_ticket THEN 4"
    " ELSE 5 END"
)


def upgrade() -> None:
    op.add_column(
        'tickets',
        sa.Column(
            'peso_orden',
            sa.SmallInteger(),
            sa.Computed(PESO_ORDEN_SQL, persisted=True),
            nullable=False,
        ),
    )
    op.create_index('idx_tickets_peso_orden', 'tickets', ['peso_orden', 'fecha_creacion'])
    op.create_index('idx_tickets_cliente', 'tickets', ['cliente_id'])
    op.create_index('idx_tickets_fecha_creacion', 'tickets', ['fecha_creacion'])
    op.create_index('idx_tickets_empresa_fecha', 'tickets', ['empresa_id', 'fecha_creacion'])
    op.create_index('idx_usuarios_empresa', 'usuarios', ['empresa_id'])


def downgrade() -> None:
    op.drop_index('idx_usuarios_empresa', table_name='usuarios')
    op.drop_index('idx_tickets_empresa_fecha', table_name='tickets')
    op.drop_index('idx_tickets_fecha_creacion', table_name='tickets')
    op.drop_index('idx_tickets_cliente', table_name='tickets')
    op.drop_index('idx_tickets_peso_orden', table_name='tickets')
    op.drop_column('tickets', 'peso_orden')
