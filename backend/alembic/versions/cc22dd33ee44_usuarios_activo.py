"""usuarios.activo para inactivar sin eliminar (trazabilidad)

Revision ID: cc22dd33ee44
Revises: bb22cc33dd44
Create Date: 2026-09-23
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'cc22dd33ee44'
down_revision: Union[str, None] = 'bb22cc33dd44'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'usuarios',
        sa.Column('activo', sa.Boolean(), nullable=False, server_default=sa.text('true')),
    )


def downgrade() -> None:
    op.drop_column('usuarios', 'activo')