"""agrega tabla push_subscriptions

Revision ID: a9b8c7d6e5f4
Revises: de6d8e810651
Create Date: 2026-07-15 18:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "a9b8c7d6e5f4"
down_revision: Union[str, None] = "de6d8e810651"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "push_subscriptions",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column("endpoint", sa.String(length=700), nullable=False),
        sa.Column("p256dh_key", sa.String(length=200), nullable=False),
        sa.Column("auth_key", sa.String(length=50), nullable=False),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("fecha_creacion", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("ultimo_envio_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("endpoint"),
    )
    op.create_index(
        "idx_push_subscriptions_usuario",
        "push_subscriptions",
        ["usuario_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_push_subscriptions_usuario", table_name="push_subscriptions")
    op.drop_table("push_subscriptions")
