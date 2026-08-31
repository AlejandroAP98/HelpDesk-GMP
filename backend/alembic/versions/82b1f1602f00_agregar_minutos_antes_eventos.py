"""agregar_minutos_antes_eventos

Revision ID: 82b1f1602f00
Revises: fcdba3116823
Create Date: 2026-08-31 17:58:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '82b1f1602f00'
down_revision: Union[str, None] = 'fcdba3116823'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('eventos_calendario', sa.Column('minutos_antes', sa.Integer(), nullable=False, server_default='15'))


def downgrade() -> None:
    try:
        op.drop_column('eventos_calendario', 'minutos_antes')
    except Exception:
        pass
