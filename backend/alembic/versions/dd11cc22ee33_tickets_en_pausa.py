"""tickets en pausa: flag + motivo + tiempo acumulado descontado del SLA

Revision ID: dd11cc22ee33
Revises: cc22dd33ee44
Create Date: 2026-10-05
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "dd11cc22ee33"
down_revision: Union[str, None] = "cc22dd33ee44"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tickets",
        sa.Column("en_pausa", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "tickets",
        sa.Column("motivo_pausa", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "tickets",
        sa.Column("fecha_pausa", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "tickets",
        sa.Column(
            "segundos_pausa_acumulado",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
    op.create_index(
        "idx_tickets_en_pausa",
        "tickets",
        ["en_pausa"],
        unique=False,
        postgresql_where=sa.text("en_pausa = true"),
    )


def downgrade() -> None:
    op.drop_index("idx_tickets_en_pausa", table_name="tickets")
    op.drop_column("tickets", "segundos_pausa_acumulado")
    op.drop_column("tickets", "fecha_pausa")
    op.drop_column("tickets", "motivo_pausa")
    op.drop_column("tickets", "en_pausa")
