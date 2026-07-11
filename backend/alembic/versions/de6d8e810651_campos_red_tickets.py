"""campos_red_tickets

Revision ID: de6d8e810651
Revises: 10dc80d2606c
Create Date: 2026-07-11 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'de6d8e810651'
down_revision: Union[str, None] = '10dc80d2606c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tickets', sa.Column('ip_pcs', sa.Text(), nullable=True))
    op.add_column('tickets', sa.Column('ip_antena', sa.Text(), nullable=True))
    op.add_column('tickets', sa.Column('mascara_red', sa.Text(), nullable=True))
    op.add_column('tickets', sa.Column('puerta_enlace', sa.Text(), nullable=True))
    op.add_column('tickets', sa.Column('nombre_punto', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('tickets', 'nombre_punto')
    op.drop_column('tickets', 'puerta_enlace')
    op.drop_column('tickets', 'mascara_red')
    op.drop_column('tickets', 'ip_antena')
    op.drop_column('tickets', 'ip_pcs')
