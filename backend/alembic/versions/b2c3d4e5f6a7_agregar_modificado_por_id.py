"""agregar modificado_por_id a tickets para trazabilidad

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-09 12:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tickets', sa.Column('modificado_por_id', sa.Uuid(), nullable=True))
    op.create_foreign_key('fk_tickets_modificado_por', 'tickets', 'usuarios', ['modificado_por_id'], ['id'], ondelete='SET NULL')
    op.execute("""
        UPDATE tickets t
        SET modificado_por_id = (
            SELECT h.usuario_id FROM historial_estados h
            WHERE h.ticket_id = t.id
            ORDER BY h.fecha DESC LIMIT 1
        )
    """)


def downgrade() -> None:
    op.drop_constraint('fk_tickets_modificado_por', 'tickets', type_='foreignkey')
    op.drop_column('tickets', 'modificado_por_id')
