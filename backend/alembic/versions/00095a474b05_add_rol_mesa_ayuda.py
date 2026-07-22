"""agrega rol mesa_ayuda al enum rol_usuario

Revision ID: 00095a474b05
Revises: 00085a474b05
Create Date: 2026-07-22 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op


revision: str = "00095a474b05"
down_revision: Union[str, None] = "00085a474b05"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE rol_usuario ADD VALUE IF NOT EXISTS 'mesa_ayuda'")


def downgrade() -> None:
    op.execute("ALTER TYPE rol_usuario RENAME TO rol_usuario_old")
    op.execute("CREATE TYPE rol_usuario AS ENUM ('cliente', 'agente', 'administrador')")
    op.execute(
        "ALTER TABLE usuarios ALTER COLUMN rol TYPE rol_usuario "
        "USING rol::text::rol_usuario"
    )
    op.execute("DROP TYPE rol_usuario_old")
