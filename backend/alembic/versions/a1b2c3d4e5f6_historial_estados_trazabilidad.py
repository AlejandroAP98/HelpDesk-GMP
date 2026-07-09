"""tabla historial_estados para trazabilidad de cambios de estado

Revision ID: a1b2c3d4e5f6
Revises: cad5c324aa81
Create Date: 2026-07-09 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'cad5c324aa81'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE historial_estados (
            id UUID NOT NULL DEFAULT gen_random_uuid(),
            ticket_id UUID NOT NULL,
            usuario_id UUID NOT NULL,
            estado_anterior estado_ticket NOT NULL,
            estado_nuevo estado_ticket NOT NULL,
            fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT
        )
    """)
    op.create_index('idx_historial_ticket', 'historial_estados', ['ticket_id'])


def downgrade() -> None:
    op.drop_index('idx_historial_ticket', table_name='historial_estados')
    op.drop_table('historial_estados')
