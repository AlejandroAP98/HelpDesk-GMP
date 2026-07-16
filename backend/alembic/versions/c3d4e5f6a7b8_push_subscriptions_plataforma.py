"""agrega plataforma a push_subscriptions para soporte FCM/APNs

Revision ID: c3d4e5f6a7b8
Revises: a9b8c7d6e5f4
Create Date: 2026-07-15 19:00:00.000000

Cambios:
- Agrega columna `plataforma` (web/ios/android) a push_subscriptions
- Hace nullable p256dh_key y auth_key (FCM/APNs no las usan)
- Backfill: todas las subscriptions existentes se marcan como 'web'
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "a9b8c7d6e5f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "push_subscriptions",
        sa.Column(
            "plataforma",
            sa.String(length=16),
            nullable=False,
            server_default="web",
        ),
    )
    op.alter_column(
        "push_subscriptions",
        "p256dh_key",
        existing_type=sa.String(length=200),
        nullable=True,
    )
    op.alter_column(
        "push_subscriptions",
        "auth_key",
        existing_type=sa.String(length=50),
        nullable=True,
    )
    op.create_index(
        "idx_push_subscriptions_plataforma",
        "push_subscriptions",
        ["plataforma"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_push_subscriptions_plataforma", table_name="push_subscriptions")
    op.drop_column("push_subscriptions", "plataforma")
    op.alter_column(
        "push_subscriptions",
        "p256dh_key",
        existing_type=sa.String(length=200),
        nullable=False,
    )
    op.alter_column(
        "push_subscriptions",
        "auth_key",
        existing_type=sa.String(length=50),
        nullable=False,
    )
