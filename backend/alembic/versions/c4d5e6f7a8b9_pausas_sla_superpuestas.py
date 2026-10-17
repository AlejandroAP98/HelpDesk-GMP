"""acumular solo pausas superpuestas al reloj SLA

Revision ID: c4d5e6f7a8b9
Revises: b263a3fcd3d8
Create Date: 2026-10-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, None] = "b263a3fcd3d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tickets",
        sa.Column(
            "segundos_pausa_sla_acumulado",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )

    tickets = sa.table(
        "tickets",
        sa.column("segundos_pausa_acumulado", sa.Integer()),
        sa.column("segundos_pausa_sla_acumulado", sa.Integer()),
    )
    op.execute(
        sa.update(tickets).values(
            segundos_pausa_sla_acumulado=tickets.c.segundos_pausa_acumulado
        )
    )


def downgrade() -> None:
    op.drop_column("tickets", "segundos_pausa_sla_acumulado")
