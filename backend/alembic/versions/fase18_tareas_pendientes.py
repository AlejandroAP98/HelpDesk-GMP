"""tabla tareas_pendientes

Revision ID: f1a2b3c4d5e6
Revises: c3d4e5f6a7b8
Create Date: 2026-07-17 20:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tareas_pendientes",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column("texto", sa.String(length=500), nullable=False),
        sa.Column("completada", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("ticket_id", sa.Uuid(), nullable=True),
        sa.Column("fecha_creacion", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("fecha_actualizacion", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_tareas_usuario",
        "tareas_pendientes",
        ["usuario_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_tareas_usuario", table_name="tareas_pendientes")
    op.drop_table("tareas_pendientes")
